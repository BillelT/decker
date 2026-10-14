import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ExportOptions, IRDocument, ThemeColorRole } from '@figma-to-slides/shared';
import { sanitizeSessionToken } from './ui/sanitizeSessionToken.js';
import { describeHttpFailure, describeJobFailure, describeNetworkFailure, describeSlideFailure, POLL_INTERRUPTED_MESSAGE, type RequestStep } from './ui/requestErrors.js';
import { exportCursorFromBatches, slideBatches, type ExportBatch, type ExportCursor } from './ui/exportCursor.js';
import { AVAILABLE_SLIDES_FONTS } from './serialize/fonts.js';
import { aggregateColorSwatches, aggregateFontUsages, colorKey } from './serialize/templateSummary.js';
import {
  postToPlugin,
  readInitialSkin,
  skinClassName,
  type AppMode,
  type FontSubstitution,
  type FrameCandidate,
  type FrameState,
  type FrameWarning,
  type Notice,
  type TemplateColorSwatch,
  type TemplateElement,
  type TemplateFontUsage,
  type TemplateLayoutState,
  type TemplateWarning,
  type UiSkin,
} from './ui/types.js';
import { DeckPanel } from './ui/DeckPanel';
import { TemplatePanel } from './ui/TemplatePanel';
import { SettingsModal } from './ui/SettingsModal';
import { FontCombobox } from './ui/FontCombobox';
import { StatusIcon } from './ui/StatusIcon';
import { ResizeGrip } from './ui/ResizeGrip';

type AuthPollResult = { status: 'pending' } | { status: 'ready'; sessionToken: string } | { status: 'error'; message: string };

type BackendConfig = { baseUrl: string };
/** `canceled` : arrêté par le bouton « Cancel » ; la présentation, si elle existe, garde les slides déjà écrites. */
type ExportState = 'idle' | 'exporting' | 'done' | 'error' | 'canceled';
type JobConclusion =
  | {
      status: 'done';
      resultUrl: string;
      /** Nombre de slides écrites (lots du job), pour le message de fin d'export. */
      slideCount: number;
    }
  | {
      status: 'failed';
      error: string;
      /** Présente dès que la présentation a été créée, même en cas d'échec partiel — la présentation existe déjà côté Drive. */
      resultUrl: string | undefined;
      /**
       * Slides dont le lot a échoué : id (`sourceNodeId`, == id du nœud Figma)
       * → message d'erreur de CE lot. Sert au bouton "Retry" ciblé ET au
       * repère posé sur la vignette concernée (badge + message dans
       * l'aperçu), pour qu'on voie enfin QUELLE slide a échoué et pourquoi.
       */
      failedSlides: Record<string, string>;
      /** Un job avec une présentation créée et au moins un lot encore non appliqué peut être repris via POST /export/:jobId/retry. */
      retryable: boolean;
    }
  | {
      status: 'canceled';
      /** Présente si la présentation avait déjà été créée avant l'annulation. */
      resultUrl: string | undefined;
      /** Slides déjà écrites au moment de l'arrêt, sur `total`. */
      slideCount: number;
      total: number;
    };

/**
 * Ce que l'export enverrait, réduit à des valeurs comparables une à une :
 * nom, choix de polices (et rôles de couleur d'un template), puis pour
 * chaque frame son id, son nom et son aperçu. L'aperçu est re-rendu à
 * chaque modification de la frame dans Figma ; à contenu identique, Figma
 * produit le même PNG, donc la même chaîne.
 */
type ExportInput = readonly string[];

/** Le panneau est-il resté tel qu'il a été exporté ? Sinon le résultat ne le reflète plus. */
function sameExportInput(exported: ExportInput | undefined, current: ExportInput): boolean {
  return exported !== undefined && exported.length === current.length && exported.every((value, i) => value === current[i]);
}

/**
 * Message d'un export arrêté par « Cancel ». Arrêté entre la création de la
 * présentation et sa première slide, il laisse une présentation vide dans
 * le Drive : le message le dit plutôt que d'annoncer qu'il n'y a rien.
 */
function canceledMessage(mode: AppMode, created: number, total: number, presentationCreated: boolean): string {
  const what = mode === 'template' ? 'Template creation' : 'Export';
  const noun = mode === 'template' ? 'layout' : 'slide';
  if (created > 0) return `${what} canceled. ${created} of ${total} ${noun}${total === 1 ? '' : 's'} ${created === 1 ? 'was' : 'were'} created.`;
  if (presentationCreated) return `${what} canceled before the first ${noun}. An empty presentation stays in your Google Drive.`;
  return `${what} canceled. Nothing was created in Google Drive.`;
}

/** Cadence de polling `/export/:jobId` pendant un export — pilote directement la progression affichée, plus de simulation temporelle. */
const POLL_INTERVAL_MS = 1000;
/** Abandon du polling au-delà de cette durée totale (la présentation peut malgré tout avoir été créée — voir `pollJob`). */
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * Durée d'affichage d'un toast avant sa fermeture automatique : le temps de
 * le lire, environ 60 ms par caractère, entre 4 et 10 secondes. Survoler le
 * toast met ce minuteur en pause (voir Toast).
 */
function noticeDuration(message: string): number {
  return Math.min(10_000, Math.max(4_000, message.length * 60));
}

/** Libellé du bouton d'ajout : le nombre de frames qu'il ajouterait, suivi en direct sur la sélection du canvas. */
function addLabel(count: number): string {
  return count === 0 ? 'Add frames' : `Add ${count} frame${count === 1 ? '' : 's'}`;
}

/** Message par défaut d'un lot échoué sans `error` côté backend. */
const FAILED_SLIDE_FALLBACK = 'This slide could not be written to Google Slides.';

/** Domaine public (Privacy Policy / Terms) — distinct du backend d'API (`backend.baseUrl`), voir CLAUDE.md. */
const SITE_URL = 'https://decker.billeltighidet.fr';

// Injectés au build (voir esbuild.config.mjs).
declare const __BACKEND_URL__: string;
declare const __LOGO_SVG__: string;
/** Section Developer de la modale Settings (Download IR JSON) — false par défaut, à activer avec F2S_DEBUG_TOOLS=1 au build pour un usage local de mainteneur. Jamais vrai dans le build distribué aux utilisateurs. */
declare const __DEBUG_TOOLS__: boolean;

/** Le backend a répondu 401 : la session Google persistée n'est plus valide — à purger avant de relancer la connexion. */
class AuthExpiredError extends Error {
  constructor() {
    super('Your Google session has expired. Sign in again, then retry.');
  }
}

/** `fetch` qui, si le réseau lâche, lève un message lisible au lieu du "Failed to fetch" du navigateur (voir ui/requestErrors.ts). */
async function request(step: RequestStep, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[decker] ${step}: no response`, err);
    throw new Error(describeNetworkFailure(step));
  }
}

/** Erreur lisible pour une réponse non-OK du backend ; le corps brut (code d'erreur, message technique) part dans la console. */
async function requestFailure(step: RequestStep, res: Response): Promise<Error> {
  const body = await res.text().catch(() => '');
  // eslint-disable-next-line no-console
  console.error(`[decker] ${step}: HTTP ${res.status}`, body);
  return new Error(describeHttpFailure(step, res.status));
}

/**
 * Monogramme "B" (assets/logo.svg, à la racine du projet), recadré sur le
 * seul B : la viewBox d'origine (80 × 80) le centre dans un disque de fond,
 * masqué ici, et laissait la moitié de la boîte vide autour de lui. Boîte
 * englobante du B mesurée au rendu (getBBox).
 */
const LOGO_MARK_SVG = __LOGO_SVG__.replace(/viewBox="[^"]*"/, 'viewBox="30.62 21 19.24 37.5"');

/**
 * Signature de l'auteur, posée en pied de panneau à gauche de "Buy me a
 * coffee" : les deux pointent vers moi, autant qu'ils voisinent, et la zone
 * Settings garde son seul rôle de réglages. Lien vers mon propre domaine :
 * `rel="noopener"` (convention de la skill signature).
 */
function Logo() {
  return (
    <a
      className="f2s-logo-link"
      href="https://billeltighidet.fr"
      target="_blank"
      rel="noopener"
      title="billeltighidet.fr"
      aria-label="Made by Billel Tighidet, billeltighidet.fr (opens in a new tab)"
    >
      <span className="f2s-logo" dangerouslySetInnerHTML={{ __html: LOGO_MARK_SVG }} />
    </a>
  );
}

/** Tracé exact d'IBM Carbon Design System (icône "settings", 32×32,
 *  licence Apache-2.0) — recopié tel quel plutôt que réapproximé à la main,
 *  après plusieurs tentatives maison ratées (dents asymétriques, puis
 *  traits droits au lieu d'un vrai contour arrondi). */
function GearIcon() {
  return (
    <svg
      className="f2s-icon-gear"
      width="14"
      height="14"
      viewBox="0 0 32 32"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M27,16.76c0-.25,0-.5,0-.76s0-.51,0-.77l1.92-1.68A2,2,0,0,0,29.3,11L26.94,7a2,2,0,0,0-1.73-1,2,2,0,0,0-.64.1l-2.43.82a11.35,11.35,0,0,0-1.31-.75l-.51-2.52a2,2,0,0,0-2-1.61H13.64a2,2,0,0,0-2,1.61l-.51,2.52a11.48,11.48,0,0,0-1.32.75L7.43,6.06A2,2,0,0,0,6.79,6,2,2,0,0,0,5.06,7L2.7,11a2,2,0,0,0,.41,2.51L5,15.24c0,.25,0,.5,0,.76s0,.51,0,.77L3.11,18.45A2,2,0,0,0,2.7,21L5.06,25a2,2,0,0,0,1.73,1,2,2,0,0,0,.64-.1l2.43-.82a11.35,11.35,0,0,0,1.31.75l.51,2.52a2,2,0,0,0,2,1.61h4.72a2,2,0,0,0,2-1.61l.51-2.52a11.48,11.48,0,0,0,1.32-.75l2.42.82a2,2,0,0,0,.64.1,2,2,0,0,0,1.73-1L29.3,21a2,2,0,0,0-.41-2.51ZM25.21,24l-3.43-1.16a8.86,8.86,0,0,1-2.71,1.57L18.36,28H13.64l-.71-3.55a9.36,9.36,0,0,1-2.7-1.57L6.79,24,4.43,20l2.72-2.4a8.9,8.9,0,0,1,0-3.13L4.43,12,6.79,8l3.43,1.16a8.86,8.86,0,0,1,2.71-1.57L13.64,4h4.72l.71,3.55a9.36,9.36,0,0,1,2.7,1.57L25.21,8,27.57,12l-2.72,2.4a8.9,8.9,0,0,1,0,3.13L27.57,20Z" />
      <path d="M16,22a6,6,0,1,1,6-6A5.94,5.94,0,0,1,16,22Zm0-10a3.91,3.91,0,0,0-4,4,3.91,3.91,0,0,0,4,4,3.91,3.91,0,0,0,4-4A3.91,3.91,0,0,0,16,12Z" />
    </svg>
  );
}

/** Flèche en diagonale d'un lien qui ouvre un site externe (icône "arrow--up-right" d'IBM Carbon, même bibliothèque que l'engrenage). */
function ArrowUpRightIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M10,6V8H22.59L6,24.59,7.41,26,24,9.41V22h2V6Z" />
    </svg>
  );
}

/** Message de fin d'un export réussi : toast en haut du panneau ET statut du footer. */
function successMessage(mode: AppMode, slideCount: number): string {
  if (mode === 'template') return `Template created in Google Slides (${slideCount} layout${slideCount === 1 ? '' : 's'}).`;
  return `${slideCount} slide${slideCount === 1 ? '' : 's'} exported to Google Slides.`;
}

/** Barre de titre du skin Windows 95 : la fenêtre du plugin en devient une vraie fenêtre 95. */
function TitleBar({ mode }: { mode: AppMode }) {
  return (
    <div className="f2s-titlebar">
      <span className="f2s-titlebar-text">Decker - {mode === 'deck' ? 'Deck export' : 'Template creation'}</span>
      {/* Seule case classique qui ait un équivalent réel côté Figma
          (`figma.closePlugin()`) — pas de réduire/agrandir décoratifs. */}
      <button
        type="button"
        className="f2s-titlebar-btn"
        title="Close the plugin"
        aria-label="Close the plugin"
        onClick={() => postToPlugin({ type: 'close-plugin' })}
      >
        ✕
      </button>
    </div>
  );
}

function App() {
  const [mode, setMode] = useState<AppMode>('deck');

  // Habillage de l'UI — le skin de marque ("modern") par défaut, l'habillage
  // rétro Windows 95 restant accessible depuis le footer. Le choix est
  // persisté côté sandbox (clientStorage) : code.ts pose déjà la bonne
  // classe sur <html> avant même le montage de React (voir
  // `readInitialSkin`), donc c'est de là que part l'état initial — pas de
  // `DEFAULT_UI_SKIN` qu'un premier rendu afficherait avant que
  // `skin-restored` n'arrive.
  const [skin, setSkin] = useState<UiSkin>(() => readInitialSkin());

  // Les deux feuilles de style scopent leurs règles sur cette classe : elle
  // vit sur <html> plutôt que sur #app pour pouvoir aussi repeindre le fond
  // du document et les ascenseurs.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(skinClassName('win95'), skin === 'win95');
    root.classList.toggle(skinClassName('modern'), skin === 'modern');
  }, [skin]);

  function changeSkin(next: UiSkin) {
    setSkin(next);
    postToPlugin({ type: 'save-ui-skin', skin: next });
  }

  // Le handler `onMessage` (branché une seule fois, deps: []) doit toujours
  // lire le mode COURANT pour router `no-frames-selected`/`too-many-frames`
  // vers le bon panneau — même piège que `sessionTokenRef` plus bas.
  const modeRef = useRef<AppMode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const [frames, setFrames] = useState<Record<string, FrameState>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();

  const [templateLayouts, setTemplateLayouts] = useState<Record<string, TemplateLayoutState>>({});
  const [templateOrder, setTemplateOrder] = useState<string[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | undefined>();
  // Notice du mode template : même toast absolu que le mode deck (voir
  // `selectionNotice` ci-dessous). Avant, c'était un texte rouge inline en
  // tête du rail, incohérent avec le mode deck et sans auto-dismiss.
  const [templateSelectionNotice, setTemplateSelectionNotice] = useState<Notice | undefined>();
  // Identifiant de la dernière notice : une notice au texte identique (même
  // erreur deux fois de suite) reste un nouveau toast, qui repart de zéro.
  const noticeIdRef = useRef(0);

  function showTemplateSelectionNotice(message: string, tone: Notice['tone'] = 'error') {
    setTemplateSelectionNotice({ id: ++noticeIdRef.current, message, tone, durationMs: noticeDuration(message) });
  }

  function clearTemplateSelectionNotice() {
    setTemplateSelectionNotice(undefined);
  }

  // Notice du mode deck (ajout refusé, préparation terminée, export réussi…) :
  // affichée en toast absolu par DeckPanel (pas de zone dédiée dans le layout
  // du rail). Le toast se ferme seul au bout de `durationMs` (voir Toast).
  const [selectionNotice, setSelectionNotice] = useState<Notice | undefined>();

  function showSelectionNotice(message: string, tone: Notice['tone'] = 'error') {
    setSelectionNotice({ id: ++noticeIdRef.current, message, tone, durationMs: noticeDuration(message) });
  }

  function clearSelectionNotice() {
    setSelectionNotice(undefined);
  }

  // Un toast appartient au mode qui l'a levé : il ne réapparaît pas, minuteur
  // remis à zéro, quand on revient sur ce mode plus tard.
  useEffect(() => {
    clearSelectionNotice();
    clearTemplateSelectionNotice();
  }, [mode]);

  const [hasCanvasSelection, setHasCanvasSelection] = useState(false);
  // Frames de la sélection du canvas qui ne sont pas encore dans chaque
  // panneau : c'est ce qu'ajouterait le bouton « Add » (code.ts,
  // `postSelectionState`).
  const [addable, setAddable] = useState({ deck: 0, template: 0 });

  const [sessionToken, setSessionToken] = useState<string | undefined>();
  // Email du compte Google connecté (GET /auth/me) — affiché dans la modale
  // Settings, section Compte (audit 2026-08 : pas de moyen de voir quel
  // compte est connecté ni de s'en déconnecter avant ce point).
  const [accountEmail, setAccountEmail] = useState<string | undefined>();
  const [loginError, setLoginError] = useState<string | undefined>();
  const [authUrl, setAuthUrl] = useState<string | undefined>();
  // A cliqué le lien "Sign in with Google" : distingue "prêt à cliquer" de
  // "en train d'attendre que l'utilisateur finisse dans le navigateur"
  // (jusqu'à 10 min de polling, pollAuthSession) — sans ça le bouton reste
  // muet sur ces deux moments d'attente très différents.
  const [authLinkClicked, setAuthLinkClicked] = useState(false);
  const [backend] = useState<BackendConfig>({ baseUrl: typeof __BACKEND_URL__ === 'string' ? __BACKEND_URL__ : 'https://decker-gamma.vercel.app' });

  /** Titres saisis par l'utilisateur — deviennent le nom du fichier créé dans Drive (un titre figé rendait chaque export indistinguable du précédent). */
  const [deckTitle, setDeckTitle] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');

  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!activeId && order.length > 0) setActiveId(order[0]);
  }, [order, activeId]);

  useEffect(() => {
    if (!activeTemplateId && templateOrder.length > 0) setActiveTemplateId(templateOrder[0]);
  }, [templateOrder, activeTemplateId]);

  /** Polices de tout le deck (bandeau « Fonts »), une par famille d'origine, dans l'ordre d'apparition des frames. */
  const deckFontSubstitutions = useMemo(() => {
    const seen = new Set<string>();
    const subs: FontSubstitution[] = [];
    for (const id of order) {
      for (const s of frames[id]?.fontSubstitutions ?? []) {
        if (seen.has(s.original)) continue;
        seen.add(s.original);
        subs.push(s);
      }
    }
    return subs;
  }, [order, frames]);

  /** Même déduplication que `deckFontSubstitutions`, pour les layouts de template. */
  const templateFontSubstitutions = useMemo(() => {
    const seen = new Set<string>();
    const subs: FontSubstitution[] = [];
    for (const id of templateOrder) {
      for (const s of templateLayouts[id]?.fontSubstitutions ?? []) {
        if (seen.has(s.original)) continue;
        seen.add(s.original);
        subs.push(s);
      }
    }
    return subs;
  }, [templateOrder, templateLayouts]);

  /** Un template ne peut être créé que si plus aucun layout n'a d'élément qui serait rasterisé. */
  const templateHasBlockingLayout = templateOrder.some((id) => templateLayouts[id]?.blocking);

  // Onglet "Style" du mode template (audit 2026-08, point 2 — TODO.md §
  // Mode template) : vue agrégée sur TOUT le template plutôt que par
  // layout, avec assignation d'un rôle de thème Slides réel à chaque
  // couleur détectée (voir mapper/theme.ts côté backend). Strictement
  // additif — un template sans aucune assignation s'exporte exactement
  // comme avant (aplats RGB statiques).
  const [colorRoles, setColorRoles] = useState<Record<string, ThemeColorRole>>({});
  const templateColors = useMemo(
    () => aggregateColorSwatches(templateOrder.map((id) => templateLayouts[id]?.colors ?? [])),
    [templateOrder, templateLayouts],
  );
  const templateFonts = useMemo(
    () => aggregateFontUsages(templateOrder.map((id) => templateLayouts[id]?.fonts ?? [])),
    [templateOrder, templateLayouts],
  );

  /**
   * Purge les rôles assignés à une couleur que le template ne contient plus
   * (layout retiré, ou recoloré dans Figma puis re-sérialisé par le live
   * refresh). `colorRoles` est indexé par couleur, pas par layout : rien ne
   * le nettoyait, et une entrée devenue invisible continuait pourtant de
   * compter. Trois conséquences, toutes silencieuses : le rôle restait
   * marqué "(in use)" dans chaque sélecteur sans qu'aucune ligne ne le
   * porte, la notif de réassignation citait une clé brute (`#RRGGBB:1.00`)
   * faute de couleur à nommer, et `buildTemplateTheme` écrivait quand même
   * un thème sur le Master (l'objet n'étant pas vide) alors qu'aucune
   * couleur visible n'avait de rôle, imposant sa palette de repli au
   * template.
   *
   * Ne tourne pas tant qu'aucune couleur n'est connue (montage, ou dernier
   * layout retiré le temps d'en ajouter un autre) : ce serait tout effacer
   * au pire moment.
   */
  useEffect(() => {
    if (templateColors.length === 0) return;
    const live = new Set(templateColors.map((c) => colorKey(c.hex, c.alpha)));
    setColorRoles((prev) => {
      const next: Record<string, ThemeColorRole> = {};
      for (const [key, role] of Object.entries(prev)) {
        if (live.has(key)) next[key] = role;
      }
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [templateColors]);

  /** Choix manuel de l'utilisateur (police originale → police Slides), envoyé à l'export pour remplacer la résolution par défaut. */
  const [fontOverrides, setFontOverrides] = useState<Record<string, string>>({});

  // Entrée de l'export de chaque mode (voir `ExportInput`), comparée à celle
  // du dernier export lancé pour savoir si son résultat est encore à jour.
  const deckInput = useMemo<ExportInput>(
    () => [deckTitle.trim(), JSON.stringify(fontOverrides), ...order.flatMap((id) => [id, frames[id]?.name ?? '', frames[id]?.previewDataUrl ?? ''])],
    [deckTitle, fontOverrides, order, frames],
  );
  const templateInput = useMemo<ExportInput>(
    () => [
      templateTitle.trim(),
      JSON.stringify(fontOverrides),
      JSON.stringify(colorRoles),
      ...templateOrder.flatMap((id) => {
        const layout = templateLayouts[id];
        // Les rôles `[[title]]`… vivent dans les noms de calques, que
        // l'aperçu ne montre pas : les éléments taguables les portent.
        return [id, layout?.name ?? '', layout?.previewDataUrl ?? '', JSON.stringify(layout?.elements ?? [])];
      }),
    ],
    [templateTitle, fontOverrides, colorRoles, templateOrder, templateLayouts],
  );

  const [exportState, setExportState] = useState<ExportState>('idle');
  // Incrémenté à chaque lancement d'export/retry — remet à zéro le rythme de
  // l'aperçu d'export paced (usePacedExportCursor) sans dépendre de
  // `exportJobId`, qui ne change PAS entre un export et son retry.
  const [exportAttempt, setExportAttempt] = useState(0);
  const [exportProgress, setExportProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | undefined>();
  const [exportError, setExportError] = useState<string | undefined>();
  // Quel mode a lancé l'export en cours/terminé : le lien "Open presentation"
  // et l'état "exporting" ne doivent apparaître QUE dans ce mode — sans ça,
  // un export de deck laissait un "Open presentation" trompeur dans le
  // panneau template (et inversement).
  const [exportSource, setExportSource] = useState<AppMode | undefined>();
  // Frame dont le lot est en cours d'application côté backend, DÉDUITE des
  // lots renvoyés par chaque poll `/export/:jobId` (exportCursorFromBatches) —
  // c'est elle que le grand aperçu du deck "génère" bande par bande pendant
  // l'export (DeckPanel → RetroExportPreview). Reflète la vitesse RÉELLE du
  // backend (plus de rythme simulé) : un export plus rapide que l'animation
  // de révélation avance simplement plus vite d'une slide à l'autre.
  const [exportCursor, setExportCursor] = useState<ExportCursor | undefined>();
  // id du job en cours/dernier terminé — nécessaire pour POST /export/:jobId/retry.
  const [exportJobId, setExportJobId] = useState<string | undefined>();
  // Slides dont le dernier lot a échoué (sourceNodeId == id du nœud Figma →
  // message d'erreur du lot) : surlignées dans le rail, détaillées dans
  // l'aperçu, et seules rejouées par le retry.
  const [failedSlides, setFailedSlides] = useState<Record<string, string>>({});
  const failedCount = Object.keys(failedSlides).length;
  // Nombre de slides du dernier export réussi, pour le message de fin
  // ("3 slides exported") : tiré du job conclu plutôt que relu dans
  // `order`, que l'utilisateur peut modifier sitôt l'export terminé.
  const [exportedCount, setExportedCount] = useState(0);
  // Taille du deck exporté, pour « 2 of 4 slides were created » après une annulation.
  const [canceledTotal, setCanceledTotal] = useState(0);
  // L'aperçu d'export (usePacedExportCursor) défile à son propre rythme et
  // finit souvent APRÈS le job : annoncer "3 slides exported" pendant qu'il
  // affiche encore "Generating slide 1 of 3" se contredisait. Le panneau
  // signale ici la fin de sa séquence (`onPreviewSettled`), et le succès
  // (toast + statut du footer) n'apparaît qu'à ce moment-là.
  const [previewSettled, setPreviewSettled] = useState(true);
  // Le job a une présentation créée et au moins un lot encore non appliqué :
  // POST /export/:jobId/retry peut rejouer UNIQUEMENT ces lots-là plutôt que
  // de forcer à ressoumettre tout le deck.
  const [retryable, setRetryable] = useState(false);
  const [retrying, setRetrying] = useState(false);
  // Annulation d'un export en cours (bouton « Cancel ») : la ref est lue par
  // `handleExportPayload` entre ses étapes, l'état n'affiche que « Canceling ».
  const [canceling, setCanceling] = useState(false);
  const cancelRequestedRef = useRef(false);
  const exportJobIdRef = useRef<string | undefined>();
  // Entrée du dernier export lancé (voir `ExportInput`) : dès que le panneau
  // s'en écarte, le résultat affiché (lien, erreurs, reprise) est périmé.
  const [exportedInput, setExportedInput] = useState<ExportInput | undefined>();
  // Slide que l'aperçu d'export affiche en ce moment (rythmé, voir
  // usePacedExportCursor) : le bouton principal en tire « Exporting 2/4 ».
  const [previewCursor, setPreviewCursor] = useState<ExportCursor | undefined>();
  const pendingAssets = useMemo(() => new Map<string, ArrayBuffer>(), []);

  /** Applique une conclusion de job (réelle) à l'état visible : fin d'export, réussie, échouée ou annulée. */
  function applyConclusion(concluded: JobConclusion) {
    setExportCursor(undefined);
    setCanceling(false);
    if (concluded.status === 'canceled') {
      setExportState('canceled');
      setExportError(undefined);
      setResultUrl(concluded.resultUrl);
      setFailedSlides({});
      setRetryable(false);
      setExportedCount(concluded.slideCount);
      setCanceledTotal(concluded.total);
      return;
    }
    if (concluded.status === 'done') {
      setExportState('done');
      setExportProgress(100);
      setResultUrl(concluded.resultUrl);
      setFailedSlides({});
      setRetryable(false);
      setExportedCount(concluded.slideCount);
    } else {
      setExportState('error');
      setExportError(concluded.error);
      setResultUrl(concluded.resultUrl);
      setFailedSlides(concluded.failedSlides);
      setRetryable(concluded.retryable);
    }
  }

  /** Progression (0–100) déduite du nombre de lots réellement conclus (`applied`/`failed`) sur le total — jamais simulée. */
  function progressFromBatches(batches: ExportBatch[] | undefined): number {
    const slides = slideBatches(batches);
    if (slides.length === 0) return 0;
    const settled = slides.filter((b) => b.status !== 'pending').length;
    return Math.round((settled / slides.length) * 100);
  }

  /**
   * Reflète un poll `/export/:jobId` en cours dans l'UI : cursor (deck ET
   * template — `exportCursorFromBatches` est générique, indexé sur
   * `sourceSlideId`, peu importe que ce soit une frame de deck ou un layout
   * de template) + barre de progression, toujours en direct.
   */
  function applyLiveBatches(batches: ExportBatch[] | undefined) {
    setExportCursor(exportCursorFromBatches(batches));
    setExportProgress(progressFromBatches(batches));
  }

  // Le handler `onMessage` ci-dessous n'est branché qu'une fois (deps: []) ;
  // sans cette ref, `handleExportPayload` y capturerait à jamais la valeur
  // de `sessionToken` telle qu'elle était au montage (undefined), et
  // l'en-tête Authorization serait alors omis même après connexion — d'où
  // un 401 permanent.
  const sessionTokenRef = useRef<string | undefined>(sessionToken);
  useEffect(() => {
    sessionTokenRef.current = sessionToken;
  }, [sessionToken]);

  // `code.ts` répond toujours à `ui-ready` par un `session-token-restored`
  // (avec un token vide si `clientStorage` n'en a aucun, cf. code.ts) — on
  // attend cette réponse avant de décider s'il faut appeler `startLogin()`,
  // pour éviter un `POST /auth/google` systématique et inutile à chaque
  // ouverture du plugin le temps que la session persistée soit restaurée
  // (audit 2026-08). Le timeout est un filet de sécurité si ce message ne
  // revient jamais (ex. iframe testée hors du sandbox Figma).
  const authHandshakeDoneRef = useRef(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'candidate-added': {
          const f = msg.frame as FrameCandidate;
          setFrames((prev) => ({
            ...prev,
            [f.id]: {
              ...f,
              previewDataUrl: msg.previewDataUrl,
              fontSubstitutions: msg.fontSubstitutions as FontSubstitution[] | undefined,
              nativeCount: msg.nativeCount as number | undefined,
              rasterCount: msg.rasterCount as number | undefined,
              warnings: msg.warnings as FrameWarning[] | undefined,
            },
          }));
          setOrder((prev) => (prev.includes(f.id) ? prev : [...prev, f.id]));
          break;
        }
        // Rafraîchissement en place d'une frame `[Slides Ready]` déjà connue
        // (re-clic sur "Prepare for Slides", ou suivi live des retouches
        // faites sur le canvas — voir `watchFramesForLiveRefresh` côté
        // code.ts) : met à jour l'aperçu SANS toucher `order`.
        case 'candidate-updated': {
          const f = msg.frame as FrameCandidate;
          setFrames((prev) =>
            prev[f.id]
              ? {
                  ...prev,
                  [f.id]: {
                    ...prev[f.id],
                    ...f,
                    previewDataUrl: msg.previewDataUrl,
                    fontSubstitutions: msg.fontSubstitutions as FontSubstitution[] | undefined,
                    nativeCount: msg.nativeCount as number | undefined,
                    rasterCount: msg.rasterCount as number | undefined,
                    warnings: msg.warnings as FrameWarning[] | undefined,
                  },
                }
              : prev,
          );
          break;
        }
        // Une frame brute du panneau vient d'être remplacée par sa copie
        // `[Slides Ready]` (préparation groupée) — retirée de la liste, la
        // copie arrive séparément via `candidate-added`.
        case 'candidate-removed': {
          const id = msg.id as string;
          setOrder((prev) => prev.filter((x) => x !== id));
          setFrames((prev) => {
            if (!(id in prev)) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
          });
          setActiveId((prev) => (prev === id ? undefined : prev));
          break;
        }
        case 'template-candidate-added': {
          const f = msg.frame as FrameCandidate;
          setTemplateLayouts((prev) => ({
            ...prev,
            [f.id]: {
              ...f,
              previewDataUrl: msg.previewDataUrl,
              warnings: (msg.warnings as TemplateWarning[]) ?? [],
              blocking: Boolean(msg.blocking),
              elements: (msg.elements as TemplateElement[]) ?? [],
              colors: (msg.colors as TemplateColorSwatch[]) ?? [],
              fonts: (msg.fonts as TemplateFontUsage[]) ?? [],
              fontSubstitutions: msg.fontSubstitutions as FontSubstitution[] | undefined,
            },
          }));
          setTemplateOrder((prev) => (prev.includes(f.id) ? prev : [...prev, f.id]));
          break;
        }
        // Boucle centrale du mode template refermée : un layout corrigé dans
        // Figma est re-validé côté sandbox (live refresh) et son rapport se
        // met à jour ICI, en place — plus besoin de supprimer/re-ajouter.
        case 'template-candidate-updated': {
          const f = msg.frame as FrameCandidate;
          setTemplateLayouts((prev) =>
            prev[f.id]
              ? {
                  ...prev,
                  [f.id]: {
                    ...prev[f.id],
                    ...f,
                    previewDataUrl: msg.previewDataUrl,
                    warnings: (msg.warnings as TemplateWarning[]) ?? [],
                    blocking: Boolean(msg.blocking),
                    elements: (msg.elements as TemplateElement[]) ?? [],
                    colors: (msg.colors as TemplateColorSwatch[]) ?? [],
                    fonts: (msg.fonts as TemplateFontUsage[]) ?? [],
                    fontSubstitutions: msg.fontSubstitutions as FontSubstitution[] | undefined,
                  },
                }
              : prev,
          );
          break;
        }
        case 'template-candidate-removed': {
          const id = msg.id as string;
          setTemplateOrder((prev) => prev.filter((x) => x !== id));
          setTemplateLayouts((prev) => {
            if (!(id in prev)) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
          });
          setActiveTemplateId((prev) => (prev === id ? undefined : prev));
          break;
        }
        case 'canvas-selection-changed':
          setHasCanvasSelection(Boolean(msg.hasSelection));
          setAddable({ deck: Number(msg.deckAddable) || 0, template: Number(msg.templateAddable) || 0 });
          break;
        // Notification d'une action faite dans le plugin (code.ts,
        // `postNotice`) : toujours dans le toast du panneau concerné, jamais
        // dans la barre de Figma.
        case 'notice': {
          const tone: Notice['tone'] = msg.tone === 'success' || msg.tone === 'info' ? msg.tone : 'error';
          if (msg.mode === 'template') showTemplateSelectionNotice(String(msg.message), tone);
          else showSelectionNotice(String(msg.message), tone);
          break;
        }
        // Habillage persisté via clientStorage (code.ts) : sans stockage
        // durable dans l'iframe UI, c'est le seul moyen que le choix
        // survive à la fermeture du plugin.
        case 'skin-restored':
          if (msg.skin === 'win95' || msg.skin === 'modern') setSkin(msg.skin);
          break;
        // Session Google persistée via clientStorage (code.ts) — restaurée à
        // l'ouverture pour ne pas refaire l'OAuth à chaque session. Sans
        // risque pour les decks déjà envoyés : chaque export crée une
        // présentation NEUVE (mode 'new-presentation').
        case 'session-token-restored': {
          authHandshakeDoneRef.current = true;
          const restored = sanitizeSessionToken(msg.token as string);
          if (restored) {
            setSessionToken(restored);
            setAuthUrl(undefined);
            setLoginError(undefined);
          } else {
            // Aucune session persistée (token vide) : c'est seulement
            // maintenant qu'on sait qu'il faut démarrer l'OAuth, pas
            // aveuglément au montage.
            startLogin();
          }
          break;
        }
        case 'export-payload':
          void handleExportPayload(
            msg.document as IRDocument,
            ((msg.assets as { assetKey: string }[] | undefined) ?? []).map((a) => a.assetKey),
          );
          break;
        case 'export-asset':
          pendingAssets.set(msg.assetKey, msg.bytes);
          break;
        case 'export-error':
          setExportState('error');
          setExportError(msg.message as string);
          break;
        // Échec du dump debug (modale Settings, section Developer) : dans le
        // toast du mode courant, là où l'utilisateur vient de cliquer.
        case 'action-error': {
          const text = String(msg.message);
          if (modeRef.current === 'template') showTemplateSelectionNotice(text);
          else showSelectionNotice(text);
          break;
        }
        // Modale Settings, section Developer : dump de l'IRDocument courant
        // en JSON téléchargeable, pour construire les fixtures de
        // calibration `fixtures/<nom>.json` (voir LIMITATIONS.md, spec §9) —
        // ne passe jamais par /assets ni /export, juste un téléchargement
        // local du document tel qu'il serait envoyé.
        case 'export-debug-payload': {
          const doc = msg.document as IRDocument;
          const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `${(doc.presentationTitle || 'fixture').replace(/[^a-z0-9-_]+/gi, '_')}.json`;
          anchor.click();
          URL.revokeObjectURL(url);
          break;
        }
        // Octets d'un asset rasterisé, pour une fixture qui contient une
        // image — même sanitisation de nom de fichier que côté
        // calibrate.ts (fixtures/<nom>-assets/<assetKey>.png), pour que le
        // nom téléchargé ici corresponde exactement à ce que le harnais va
        // chercher.
        case 'export-debug-asset': {
          const assetKey = msg.assetKey as string;
          const bytes = msg.bytes as ArrayBuffer;
          const blob = new Blob([bytes], { type: 'image/png' });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `${assetKey.replace(/[^a-z0-9-_]+/gi, '_')}.png`;
          anchor.click();
          URL.revokeObjectURL(url);
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Les fonctions serverless Vercel plafonnent le corps d'une requête à
  // ~4.5 Mo — un deck de plusieurs dizaines de slides avec beaucoup
  // d'éléments rasterisés dépasse vite cette limite si on envoie tous les
  // assets dans la même requête POST /export (413, et comme Vercel rejette
  // la requête avant qu'Express n'ajoute les en-têtes CORS, le navigateur
  // le rapporte à tort comme une erreur CORS). On uploade donc les assets
  // par lots via POST /assets d'abord, puis on envoie /export sans pièce
  // jointe (juste le JSON du document, toujours petit).
  const ASSET_BATCH_BUDGET_BYTES = 3.5 * 1024 * 1024;

  async function uploadAssetBatches(assets: [string, ArrayBuffer][]): Promise<void> {
    let batch: [string, ArrayBuffer][] = [];
    let batchBytes = 0;

    const flush = async () => {
      if (batch.length === 0) return;
      const form = new FormData();
      for (const [assetKey, buf] of batch) {
        form.append(assetKey, new Blob([buf], { type: 'image/png' }), assetKey);
      }
      const res = await request('upload', `${backend.baseUrl}/assets`, {
        method: 'POST',
        body: form,
        headers: sessionTokenRef.current ? { Authorization: `Bearer ${sessionTokenRef.current}` } : undefined,
        credentials: 'include',
      });
      if (res.status === 401) throw new AuthExpiredError();
      if (!res.ok) throw await requestFailure('upload', res);
      batch = [];
      batchBytes = 0;
    };

    for (const asset of assets) {
      const size = asset[1].byteLength;
      if (batch.length > 0 && batchBytes + size > ASSET_BATCH_BUDGET_BYTES) {
        await flush();
      }
      batch.push(asset);
      batchBytes += size;
    }
    await flush();
  }

  /**
   * Les assets arrivent par messages `export-asset` séparés juste après
   * `export-payload` : on attend que TOUTES les clés annoncées dans le
   * payload soient là (déterministe), au lieu de l'ancien délai fixe de
   * 50 ms qui pariait sur la vitesse de livraison des messages.
   */
  async function waitForExpectedAssets(expectedKeys: string[]): Promise<void> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (expectedKeys.every((k) => pendingAssets.has(k))) return;
      await new Promise((r) => setTimeout(r, 25));
    }
    const missing = expectedKeys.filter((k) => !pendingAssets.has(k)).length;
    throw new Error(`${missing === 1 ? 'An image' : `${missing} images`} never arrived from Figma. Close and reopen the plugin, then try again.`);
  }

  async function handleExportPayload(doc: IRDocument, expectedAssetKeys: string[]) {
    setExportState('exporting');
    setExportAttempt((n) => n + 1);
    setExportProgress(0);
    setExportError(undefined);
    // Annulé avant que le job existe (sandbox encore en train de préparer le
    // document, ou upload des images) : on s'arrête à l'étape suivante, sans
    // rien créer dans le Drive.
    const canceledBeforeJob: JobConclusion = { status: 'canceled', resultUrl: undefined, slideCount: 0, total: doc.slides.length };
    try {
      if (cancelRequestedRef.current) return applyConclusion(canceledBeforeJob);
      // Purge des assets d'un export précédent (ou de frames retirées depuis)
      // encore bufferisés : sans ça, chaque nouvel export ré-uploadait tout
      // l'historique de la session.
      const expected = new Set(expectedAssetKeys);
      for (const key of [...pendingAssets.keys()]) {
        if (!expected.has(key)) pendingAssets.delete(key);
      }
      await waitForExpectedAssets(expectedAssetKeys);
      if (cancelRequestedRef.current) return applyConclusion(canceledBeforeJob);
      await uploadAssetBatches(expectedAssetKeys.map((k) => [k, pendingAssets.get(k)!]));
      pendingAssets.clear();
      if (cancelRequestedRef.current) return applyConclusion(canceledBeforeJob);

      const form = new FormData();
      form.append('document', JSON.stringify(doc));

      const res = await request('export', `${backend.baseUrl}/export`, {
        method: 'POST',
        body: form,
        headers: sessionTokenRef.current ? { Authorization: `Bearer ${sessionTokenRef.current}` } : undefined,
        credentials: 'include',
      });
      if (res.status === 401) throw new AuthExpiredError();
      if (!res.ok) throw await requestFailure('export', res);
      const { jobId } = await res.json();
      setExportJobId(jobId);
      exportJobIdRef.current = jobId;
      // « Cancel » cliqué pendant l'envoi de /export : le job vient d'être
      // créé, on le fait arrêter tout de suite (avant la présentation si
      // possible) et le polling ci-dessous verra `canceled`.
      if (cancelRequestedRef.current) void sendCancel(jobId);
      const concluded = await pollJob(jobId, applyLiveBatches);
      applyConclusion(concluded);
    } catch (err) {
      setExportState('error');
      setExportCursor(undefined);
      setCanceling(false);
      setExportError(err instanceof Error ? err.message : String(err));
      if (err instanceof AuthExpiredError) {
        // Session Google périmée : on purge le jeton persisté et on repart
        // sur le flow de connexion, plutôt que de laisser chaque tentative
        // rejouer le même 401.
        setSessionToken(undefined);
        postToPlugin({ type: 'clear-session-token' });
        startLogin();
      }
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }

  /**
   * Lots `failed` d'un poll `/export/:jobId`, sous la forme utilisée par
   * `JobConclusion`. Le message brut de Google Slides est traduit en conseil
   * (ui/requestErrors.ts) et gardé tel quel dans la console.
   */
  function failedSlidesFrom(batches: ExportBatch[] | undefined): Record<string, string> {
    const noun = modeRef.current === 'template' ? 'layout' : 'slide';
    const failed: Record<string, string> = {};
    for (const b of batches ?? []) {
      if (b.status !== 'failed') continue;
      if (b.error) {
        // eslint-disable-next-line no-console
        console.error(`[decker] ${noun} ${b.sourceSlideId} failed:`, b.error);
      }
      failed[b.sourceSlideId] = b.error ? describeSlideFailure(b.error, noun) : FAILED_SLIDE_FALLBACK;
    }
    return failed;
  }

  /**
   * Sonde `/export/:jobId` à `POLL_INTERVAL_MS` jusqu'à conclusion (réussie
   * ou non), en appelant `onUpdate` à CHAQUE poll (mode deck : fait avancer
   * `exportCursor` en direct ; barre de progression toujours à jour, quelle
   * que soit la vitesse réelle du backend) — puis la RENVOIE sans toucher au
   * state directement, c'est `applyConclusion` qui s'en charge.
   */
  async function pollJob(jobId: string, onUpdate: (batches: ExportBatch[] | undefined) => void): Promise<JobConclusion> {
    let lastPresentationUrl: string | undefined;
    let lastPresentationId: string | undefined;
    try {
      for (let i = 0; i < Math.ceil(POLL_TIMEOUT_MS / POLL_INTERVAL_MS); i++) {
        const res = await fetch(`${backend.baseUrl}/export/${jobId}`, { credentials: 'include' });
        const job = await res.json();
        const batches = job.batches as ExportBatch[] | undefined;
        lastPresentationUrl = job.presentationUrl ?? lastPresentationUrl;
        lastPresentationId = job.presentationId ?? lastPresentationId;
        onUpdate(batches);
        if (job.status === 'done') {
          return { status: 'done', resultUrl: job.presentationUrl, slideCount: slideBatches(batches).length };
        }
        if (job.status === 'canceled') {
          const slides = slideBatches(batches);
          return {
            status: 'canceled',
            resultUrl: job.presentationUrl,
            slideCount: slides.filter((b) => b.status === 'applied').length,
            total: slides.length,
          };
        }
        if (job.status === 'failed') {
          // Priorité aux erreurs par slide (`batch.error`) : bien plus
          // actionnables que le message générique de `job.error`, qui ne
          // couvre que l'échec global (ex. la création de présentation
          // elle-même a échoué, avant même le premier lot).
          const failedSlides = failedSlidesFrom(batches);
          const failedCount = Object.keys(failedSlides).length;
          // Le mode courant est celui qui a lancé le job (onglets désactivés
          // pendant l'export) ; `modeRef`, fonction appelée depuis `onMessage`.
          const noun = modeRef.current === 'template' ? 'layout' : 'slide';
          // eslint-disable-next-line no-console
          if (failedCount === 0) console.error('[decker] export job failed:', job.error);
          return {
            status: 'failed',
            // Le détail de chaque slide vit désormais sur sa vignette : le
            // footer n'a plus qu'à dire combien ont échoué, au lieu de
            // concaténer tous les messages bruts sur une ligne tronquée.
            error:
              failedCount > 0
                ? `${failedCount} ${noun}${failedCount === 1 ? '' : 's'} failed. Select the flagged thumbnail${failedCount === 1 ? '' : 's'} to see why.`
                : describeJobFailure(noun),
            resultUrl: job.presentationUrl,
            failedSlides,
            retryable: Boolean(job.presentationId) && failedCount > 0,
          };
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      // Le job continue peut-être de tourner côté serveur au-delà de ce délai
      // (waitUntil n'a pas de limite propre) : si une présentation a déjà été
      // créée, on la propose quand même plutôt que de ne rien montrer.
      return {
        status: 'failed',
        error: 'Export timed out after 3 minutes. The presentation may still be processing; check your Google Drive, or retry once it settles.',
        resultUrl: lastPresentationUrl,
        failedSlides: {},
        retryable: Boolean(lastPresentationId),
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[decker] export polling interrupted', err);
      return {
        status: 'failed',
        error: POLL_INTERRUPTED_MESSAGE,
        resultUrl: lastPresentationUrl,
        failedSlides: {},
        retryable: Boolean(lastPresentationId),
      };
    }
  }

  /**
   * Rejoue UNIQUEMENT les lots encore en échec du dernier job (POST
   * /export/:jobId/retry, backend jobs/runner.ts `retryExportJob`) — jamais
   * une nouvelle présentation, jamais les slides déjà réussies. Même job
   * (même `exportJobId`), donc même polling ensuite.
   */
  async function handleRetryFailedSlides() {
    if (!exportJobId) return;
    setRetrying(true);
    setPreviewSettled(false);
    setExportState('exporting');
    setExportAttempt((n) => n + 1);
    setExportError(undefined);
    cancelRequestedRef.current = false;
    setCanceling(false);
    setPreviewCursor(undefined);
    try {
      const res = await request('retry', `${backend.baseUrl}/export/${exportJobId}/retry`, {
        method: 'POST',
        headers: sessionTokenRef.current ? { Authorization: `Bearer ${sessionTokenRef.current}` } : undefined,
        credentials: 'include',
      });
      if (res.status === 401) throw new AuthExpiredError();
      if (!res.ok) throw await requestFailure('retry', res);
      const concluded = await pollJob(exportJobId, applyLiveBatches);
      applyConclusion(concluded);
    } catch (err) {
      setExportState('error');
      setExportCursor(undefined);
      setCanceling(false);
      setExportError(err instanceof Error ? err.message : String(err));
      if (err instanceof AuthExpiredError) {
        setSessionToken(undefined);
        postToPlugin({ type: 'clear-session-token' });
        startLogin();
      }
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setRetrying(false);
    }
  }

  /** Demande au backend d'arrêter le job (POST /export/:jobId/cancel). En cas d'échec, l'export continue et se termine normalement. */
  async function sendCancel(jobId: string): Promise<void> {
    try {
      const res = await fetch(`${backend.baseUrl}/export/${jobId}/cancel`, { method: 'POST', credentials: 'include' });
      // 409 : le job s'est terminé entre-temps, le polling en rendra compte.
      if (res.ok || res.status === 409) return;
      // eslint-disable-next-line no-console
      console.error(`[decker] cancel: HTTP ${res.status}`, await res.text().catch(() => ''));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[decker] cancel: no response', err);
    }
    cancelRequestedRef.current = false;
    setCanceling(false);
    const message = "Couldn't cancel. The export keeps going and will finish on its own.";
    if (modeRef.current === 'template') showTemplateSelectionNotice(message);
    else showSelectionNotice(message);
  }

  /**
   * Bouton « Cancel » pendant un export : arrête le job côté serveur avant
   * la slide suivante (la présentation garde ce qui est déjà écrit), ou,
   * si le job n'existe pas encore, empêche sa création.
   */
  function handleCancelExport() {
    if (cancelRequestedRef.current) return;
    cancelRequestedRef.current = true;
    setCanceling(true);
    if (exportJobIdRef.current) void sendCancel(exportJobIdRef.current);
  }

  /**
   * Sonde `/auth/session/:pollId` jusqu'à ce que le callback OAuth (ouvert
   * dans l'onglet externe par le lien "Sign in with Google") ait produit un
   * jeton de session — l'utilisateur se connecte dans l'onglet Google puis
   * revient sur Figma, le plugin détecte la connexion tout seul.
   */
  async function pollAuthSession(pollId: string) {
    for (let i = 0; i < 400; i++) {
      if (sessionTokenRef.current) return;
      try {
        const res = await fetch(`${backend.baseUrl}/auth/session/${pollId}`, { credentials: 'include' });
        const result = (await res.json()) as AuthPollResult;
        if (result.status === 'ready') {
          const token = sanitizeSessionToken(result.sessionToken);
          setSessionToken(token);
          setAuthUrl(undefined);
          if (token) postToPlugin({ type: 'save-session-token', token });
          return;
        }
        if (result.status === 'error') {
          // eslint-disable-next-line no-console
          console.error('[decker] Google sign-in failed:', result.message);
          setLoginError("Google sign-in didn't complete. Try again.");
          setAuthUrl(undefined);
          return;
        }
      } catch {
        // Coupure réseau transitoire : on retente au prochain tour plutôt
        // que d'abandonner tout de suite.
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setLoginError('Sign-in timed out. Try again.');
    setAuthUrl(undefined);
  }

  function startLogin() {
    setLoginError(undefined);
    setAuthUrl(undefined);
    setAuthLinkClicked(false);
    // Ni fetch()-puis-window.open() ni window.open() synchrone ne
    // marchent depuis l'iframe d'un plugin Figma Desktop : Figma essaie
    // de rendre la popup DANS un cadre soumis à la CSP restrictive du
    // plugin (limitée aux domaines de networkAccess), ce qui bloque
    // accounts.google.com avec une erreur "Framing ... violates CSP".
    // La méthode recommandée par Figma est un vrai lien <a target="_blank">
    // cliqué par l'utilisateur — ça sort du cadre CSP du plugin comme une
    // navigation externe normale.
    //
    // Ce fetch() ne dépend PAS d'un geste utilisateur : demander l'URL au
    // backend est indépendant du clic qui ouvrira ensuite le navigateur, donc
    // on le lance dès le montage (voir l'effet plus bas) pour que le lien
    // soit déjà prêt — l'utilisateur n'a alors besoin que d'UN clic dessus.
    // `skin` voyage jusqu'à la page /auth/callback (onglet de navigateur hors
    // iframe Figma) pour qu'elle reprenne le même habillage que le plugin —
    // voir routes/auth.ts côté backend.
    request('sign-in', `${backend.baseUrl}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skin }),
    })
      .then(async (res) => {
        if (!res.ok) throw await requestFailure('sign-in', res);
        return res.json();
      })
      .then(({ authUrl, pollId }) => {
        setAuthUrl(authUrl);
        void pollAuthSession(pollId);
      })
      .catch((err) => {
        setLoginError(err instanceof Error ? err.message : String(err));
        // eslint-disable-next-line no-console
        console.error('[figma-to-slides] startLogin failed', err);
      });
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (authHandshakeDoneRef.current) return;
      authHandshakeDoneRef.current = true;
      startLogin();
    }, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Récupère l'email du compte connecté dès qu'une session existe (connexion
  // fraîche ou restaurée depuis clientStorage) — purement informatif pour la
  // modale Settings, une 401 ici n'est pas traitée comme une session expirée
  // (le reste de l'app le fera bien assez tôt au prochain appel qui compte).
  useEffect(() => {
    if (!sessionToken) {
      setAccountEmail(undefined);
      return;
    }
    let cancelled = false;
    fetch(`${backend.baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : undefined))
      .then((body: { email?: string | null } | undefined) => {
        if (!cancelled) setAccountEmail(body?.email ?? undefined);
      })
      .catch(() => {
        if (!cancelled) setAccountEmail(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionToken, backend.baseUrl]);

  /**
   * Section Compte de la modale Settings (audit 2026-08) : purge la session
   * locale et côté backend, puis relance le flow de connexion — le lien
   * "Sign in with Google" qui réapparaît proposera le sélecteur de compte
   * Google (prompt=select_account, voir oauth.ts) plutôt que de resigner
   * automatiquement le même compte, donc sert aussi à "changer de compte".
   */
  function handleSignOut() {
    const token = sessionTokenRef.current;
    setSessionToken(undefined);
    setAccountEmail(undefined);
    postToPlugin({ type: 'clear-session-token' });
    setSettingsOpen(false);
    if (token) {
      fetch(`${backend.baseUrl}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      }).catch(() => {
        // Best-effort : la session locale est déjà purgée, un backend
        // injoignable ne doit pas empêcher l'utilisateur de se reconnecter.
      });
    }
    startLogin();
  }

  // Signale à code.ts que l'iframe a fini de monter : un `figma.ui.postMessage`
  // envoyé avant ce point (ex. la découverte des frames déjà taguées
  // `slidesExportReady` à la réouverture du plugin, ou la session Google
  // persistée) serait perdu, `postMessage` ne bufferisant rien côté
  // destinataire.
  useEffect(() => {
    postToPlugin({ type: 'ui-ready' });
  }, []);

  /** Section Developer de la modale Settings — voir le commentaire de `request-export-debug` côté code.ts. */
  function handleExportDebugIr() {
    postToPlugin({ type: 'request-export-debug', includedFrameIds: order, order, presentationTitle: deckTitle.trim() || 'fixture', fontOverrides });
  }

  function handlePrepareForSlides() {
    // `order` (tout le deck déjà dans le panneau) part avec le message : le
    // bouton prépare ainsi TOUTES les frames déjà ajoutées, pas seulement
    // celles qui se trouvent par ailleurs sélectionnées sur le canvas Figma
    // au moment du clic (code.ts fait l'union des deux).
    postToPlugin({ type: 'prepare-for-slides', deckFrameIds: order, fontOverrides });
  }

  function handlePrepareTemplateForSlides() {
    // Même flow côté template : le reformatage automatique élimine la
    // majorité des avertissements bloquants (dégradés aplatis, ombres
    // retirées, tracking remis à zéro…) — voir code.ts.
    postToPlugin({ type: 'prepare-template-for-slides', layoutFrameIds: templateOrder, fontOverrides });
  }

  /** Ajoute au deck les frames sélectionnées sur le canvas, dans l'ordre de sélection (code.ts, `orderedSelectedFrames`). */
  function handleAddFramesClick() {
    clearSelectionNotice();
    postToPlugin({ type: 'add-selected-frames' });
  }

  function removeFrame(id: string) {
    // Sans ce message, code.ts gardait l'entrée dans son `pending` interne
    // (le retrait ci-dessous n'est que local à l'UI) : tout ré-ajout de
    // cette même frame était alors silencieusement ignoré (dédoublonnage par
    // id côté sandbox) jusqu'à fermer/rouvrir le plugin.
    postToPlugin({ type: 'remove-frame', id });
    setOrder((prev) => prev.filter((x) => x !== id));
    setFrames((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveId((prev) => (prev === id ? undefined : prev));
  }

  function handleAddTemplateLayoutClick() {
    clearTemplateSelectionNotice();
    postToPlugin({ type: 'add-template-layout' });
  }

  function removeTemplateLayout(id: string) {
    // Voir le commentaire équivalent dans `removeFrame`.
    postToPlugin({ type: 'remove-template-layout', id });
    setTemplateOrder((prev) => prev.filter((x) => x !== id));
    setTemplateLayouts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveTemplateId((prev) => (prev === id ? undefined : prev));
  }

  function renameTemplateLayout(id: string, name: string) {
    setTemplateLayouts((prev) => {
      const layout = prev[id];
      if (!layout) return prev;
      return { ...prev, [id]: { ...layout, name } };
    });
  }

  /**
   * Le champ de nom d'une vignette de layout ne modifiait que l'état de
   * l'UI : le nom n'était jamais renvoyé au sandbox, il n'atteignait donc ni
   * l'export (qui repart de `frame.name`), ni la réouverture du plugin (où
   * les layouts sont rechargés depuis Figma). Il renomme désormais la vraie
   * frame, à la validation seulement (blur/Entrée) plutôt qu'à chaque
   * frappe. Voir TemplatePanel.onRenameCommit.
   *
   * Un nom vidé n'est pas propagé : Figma renommerait la frame selon son
   * type et le rail perdrait le repère du créateur. La saisie en cours reste
   * telle quelle, elle sera écrasée par le prochain rafraîchissement du
   * layout.
   */
  function commitTemplateLayoutRename(id: string, name: string) {
    if (name.trim().length === 0) return;
    postToPlugin({ type: 'rename-template-layout', id, name: name.trim() });
  }

  /** Remise à zéro commune au lancement d'un export (deck) ou d'une création de template. */
  function beginExport(source: AppMode, input: ExportInput) {
    setExportState('exporting');
    setExportProgress(0);
    setExportSource(source);
    setPreviewSettled(false);
    setExportCursor(undefined);
    setExportJobId(undefined);
    exportJobIdRef.current = undefined;
    cancelRequestedRef.current = false;
    setCanceling(false);
    setFailedSlides({});
    setRetryable(false);
    setExportedInput(input);
    setPreviewCursor(undefined);
  }

  function startExport() {
    beginExport('deck', deckInput);
    const options: ExportOptions = {
      mode: 'new-presentation',
      rasterScale: 2,
      includeUnderlay: false,
      underlayOpacity: 0.3,
      strictMode: false,
    };
    postToPlugin({
      type: 'request-export',
      includedFrameIds: order,
      order,
      options,
      presentationTitle: deckTitle.trim() || 'Decker export',
      fontOverrides,
    });
  }

  /**
   * Réutilise le MÊME pipeline d'export que le deck : côté backend, un
   * template n'est jamais qu'une présentation dont chaque slide est un
   * layout réutilisable — mêmes endpoints `/assets` + `/export`.
   */
  function startTemplateCreate() {
    beginExport('template', templateInput);
    postToPlugin({
      type: 'request-template',
      includedFrameIds: templateOrder,
      order: templateOrder,
      presentationTitle: templateTitle.trim() || 'Figma template',
      fontOverrides,
      colorRoles,
    });
  }

  const exporting = exportState === 'exporting';
  // Un aperçu démonté (l'utilisateur a changé d'onglet sitôt l'export
  // conclu) ne signalera jamais sa fin : il n'y a alors plus rien à attendre.
  const successVisible = exportState === 'done' && (previewSettled || exportSource !== mode);

  // Confirmation là où l'œil se trouve (l'aperçu, en haut du panneau), en
  // plus du statut persistant du footer qui porte le lien. Une fois par
  // export réussi : l'effet ne repasse que si l'état ou la fin d'aperçu change.
  useEffect(() => {
    if (!successVisible || exportSource === undefined) return;
    const text = successMessage(exportSource, exportedCount);
    if (exportSource === 'template') showTemplateSelectionNotice(text, 'success');
    else showSelectionNotice(text, 'success');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [successVisible]);

  // Le pipeline d'export (assets bufferisés, polling) est partagé : un seul
  // export à la fois, mais le mode qui n'a PAS lancé l'export en cours
  // explique pourquoi son bouton attend au lieu d'être grisé sans raison.
  const busyFromOtherMode = exporting && exportSource !== undefined && exportSource !== mode;
  const busyTitle = exportSource === 'deck' ? 'A deck export is still running. Wait for it to finish.' : 'A template creation is still running. Wait for it to finish.';
  // Export conclu (réussi, échoué ou annulé). Un export annulé n'a plus
  // d'aperçu à dérouler : sa tentative n'est pas transmise aux panneaux, qui
  // s'arrêtent net au lieu de « générer » les slides qui ne partiront pas.
  const concludedExport = exportState === 'done' || exportState === 'error' || exportState === 'canceled';
  const concludedHere = exportSource === mode && concludedExport;
  // Le panneau n'a pas bougé depuis cet export : son résultat (lien, erreurs
  // par slide, reprise) le reflète encore. Dès qu'on ajoute, retire,
  // réordonne, renomme ou retouche une frame, le résultat est périmé et le
  // bouton principal redevient « Export again ».
  const resultCurrent = concludedHere && sameExportInput(exportedInput, mode === 'deck' ? deckInput : templateInput);
  // Job conclu mais aperçu encore en train de « générer » ses dernières
  // slides : le bouton garde la progression jusqu'au bout de l'aperçu.
  const settlingHere = concludedHere && !previewSettled;
  // Fin d'export du mode courant : réussie ou non, la présentation existe
  // (au moins en partie) dans Drive. Relancer en crée une NOUVELLE, jamais
  // une mise à jour : le bouton principal le dit ("again") au lieu de
  // redevenir un "Export" anodin qui produisait un doublon sans prévenir.
  const exportedHere = concludedHere && Boolean(resultUrl);
  const againTitle = 'Creates a new presentation in your Google Drive. The one you just exported stays as it is.';
  // Échecs par slide du dernier export de CE mode, pour le repère sur les
  // vignettes : rien à montrer dans l'autre mode, ni une fois l'erreur levée
  // ou le deck modifié depuis.
  const failedSlidesHere = exportState === 'error' && resultCurrent ? failedSlides : undefined;

  /**
   * Bouton d'ajout, un seul clic : il suit en direct le nombre de frames
   * sélectionnées sur le canvas qui ne sont pas encore dans le panneau, et
   * reste grisé tant qu'il n'y en a aucune. Remplace l'ancien aller-retour
   * « Select frames », sélection, puis « Add selection » sur le même bouton.
   */
  function renderAddAction(count: number, panel: AppMode, onClick: () => void) {
    const where = panel === 'deck' ? 'the deck' : 'the template';
    const title = exporting
      ? `${panel === 'deck' ? 'An export' : 'A template creation'} is running. Wait for it to finish before changing ${where}.`
      : count > 0
        ? `Add the selected frames to ${where}, in the order you selected them.`
        : hasCanvasSelection
          ? `The selected frames are already in ${where}.`
          : `Select frames on the Figma canvas to add them to ${where}.`;
    return (
      <button type="button" className="f2s-btn f2s-btn--secondary f2s-tabular" disabled={exporting || count === 0} title={title} onClick={onClick}>
        {addLabel(count)}
      </button>
    );
  }

  /**
   * Bouton principal du header, qui suit l'étape du mode courant :
   * - sans session Google : la connexion ;
   * - pendant l'export : la progression (« Exporting 2/4 »), et « Cancel » à côté ;
   * - export terminé, panneau inchangé depuis : « Open in Slides » ;
   * - sinon : « Export » (« Export again » si une présentation existe déjà).
   * L'ajout de frames reste un bouton à part (`renderAddAction`), toujours
   * disponible : le principal ne lui vole jamais sa place.
   */
  function renderPrimaryActions() {
    const isDeck = mode === 'deck';
    const startLabel = isDeck ? (exportedHere ? 'Export again' : 'Export') : exportedHere ? 'Create again' : 'Create template';
    if (!sessionToken) return renderSignIn(startLabel);

    if (exportSource === mode && (exporting || settlingHere)) {
      // Sans points de suspension : le spinner dit déjà que ça tourne, et à
      // 960 px de large le header n'a pas un caractère de trop.
      const verb = canceling ? 'Canceling' : isDeck ? 'Exporting' : 'Creating';
      const label = previewCursor && !canceling ? `${verb} ${previewCursor.index + 1}/${previewCursor.total}` : verb;
      return (
        <>
          {exporting && (
            <button
              type="button"
              className="f2s-btn f2s-btn--secondary"
              disabled={canceling}
              title={`Stop after the ${isDeck ? 'slide' : 'layout'} being written. What's already created stays in Google Slides.`}
              onClick={handleCancelExport}
            >
              Cancel
            </button>
          )}
          {/* Un état, pas une action : pas de bouton grisé (qui se lirait
              « indisponible »), et l'avancée est déjà annoncée par la région
              `status` du panneau. */}
          <span className="f2s-btn f2s-btn--primary f2s-btn--busy f2s-tabular">
            <span className="f2s-btn-loading">
              <span className="f2s-spinner" aria-hidden="true" />
              {label}
            </span>
          </span>
        </>
      );
    }

    if (resultCurrent && resultUrl && exportState !== 'canceled') {
      return (
        <a
          href={resultUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="f2s-btn f2s-btn--primary f2s-btn--icon-end"
          title={isDeck ? 'Open the presentation in Google Slides.' : 'Open the template in Google Slides.'}
        >
          Open in Slides
          <ArrowUpRightIcon />
        </a>
      );
    }

    const disabled = busyFromOtherMode || (isDeck ? order.length === 0 : templateOrder.length === 0 || templateHasBlockingLayout);
    const title = busyFromOtherMode
      ? busyTitle
      : !isDeck && templateHasBlockingLayout
        ? 'Fix the blocking issues listed below before creating the template.'
        : exportedHere
          ? againTitle
          : undefined;
    return (
      <button type="button" className="f2s-btn f2s-btn--primary" disabled={disabled} title={title} onClick={isDeck ? startExport : startTemplateCreate}>
        {startLabel}
      </button>
    );
  }

  /** Flow de connexion Google, à la place du bouton principal tant qu'aucune session n'existe : le lien dit ce qu'il fait ("Sign in with Google"), plus de bouton "Export" qui ouvre en réalité l'OAuth. */
  function renderSignIn(label: string) {
    if (authUrl) {
      // Un vrai <a target="_blank"> cliqué par l'utilisateur : voir le
      // commentaire de startLogin sur la CSP du plugin Figma. Reste
      // cliquable même après le premier clic (authLinkClicked) : au cas où
      // l'utilisateur a fermé l'onglet Google par erreur, il peut le
      // rouvrir sans repartir de zéro (pollAuthSession tourne déjà).
      return (
        <a
          href={authUrl}
          target="_blank"
          rel="noreferrer"
          className="f2s-btn f2s-btn--primary"
          title={authLinkClicked ? 'Finish signing in with Google in the browser tab. Click again to reopen it if you closed it.' : `Connect your Google account to enable "${label}".`}
          onClick={() => setAuthLinkClicked(true)}
        >
          {authLinkClicked ? (
            <span className="f2s-btn-loading">
              <span className="f2s-spinner" aria-hidden="true" />
              Waiting…
            </span>
          ) : (
            'Sign in with Google'
          )}
        </a>
      );
    }
    if (loginError) {
      return (
        <button type="button" className="f2s-btn f2s-btn--primary" title={loginError} onClick={startLogin}>
          Retry Google sign-in
        </button>
      );
    }
    // Chargement initial : l'URL Google n'a pas encore été récupérée auprès
    // du backend (fetch lancé au montage, voir l'effet plus bas).
    return (
      <button type="button" className="f2s-btn f2s-btn--primary" disabled>
        <span className="f2s-btn-loading">
          <span className="f2s-spinner" aria-hidden="true" />
          Preparing sign-in…
        </span>
      </button>
    );
  }

  /**
   * Statut du dernier export de ce mode, dans le footer, avec l'action qui
   * en découle juste à côté : « Retry » après un échec, « Export again »
   * après un succès (le lien vers la présentation est alors le bouton
   * principal), le lien vers ce qui a été créé après une annulation. Masqué
   * dès que le panneau a changé depuis l'export : il ne décrirait plus ce
   * qu'on a sous les yeux.
   */
  function renderExportStatus() {
    if (!resultCurrent) return null;
    const noun = mode === 'template' ? 'layout' : 'slide';
    if (exportState === 'error' && exportError) {
      return (
        <>
          <p className="f2s-footer-status f2s-footer-status--error" role="alert" title={exportError}>
            <StatusIcon tone="error" />
            <span className="f2s-footer-status-text">{exportError}</span>
          </p>
          {/* Reprise ciblée (backend jobs/runner.ts `retryExportJob`) : ne
              rejoue QUE les slides encore en échec, jamais tout le deck : la
              présentation déjà créée (et les slides déjà réussies) reste
              intacte pendant l'attente. */}
          {retryable && (
            <button type="button" className="f2s-btn f2s-btn--secondary f2s-btn--footer" disabled={retrying} onClick={handleRetryFailedSlides}>
              {retrying ? 'Retrying…' : `Retry ${failedCount} failed ${noun}${failedCount === 1 ? '' : 's'}`}
            </button>
          )}
        </>
      );
    }
    if (successVisible && exportState === 'done') {
      return (
        <>
          <p className="f2s-footer-status f2s-footer-status--success" role="status">
            <StatusIcon tone="success" />
            <span className="f2s-footer-status-text">{successMessage(mode, exportedCount)}</span>
          </p>
          <button
            type="button"
            className="f2s-btn f2s-btn--secondary f2s-btn--footer"
            title={againTitle}
            onClick={mode === 'deck' ? startExport : startTemplateCreate}
          >
            {mode === 'deck' ? 'Export again' : 'Create again'}
          </button>
        </>
      );
    }
    if (exportState === 'canceled' && previewSettled) {
      return (
        <>
          <p className="f2s-footer-status f2s-footer-status--info" role="status">
            <StatusIcon tone="info" />
            <span className="f2s-footer-status-text">{canceledMessage(mode, exportedCount, canceledTotal, Boolean(resultUrl))}</span>
          </p>
          {resultUrl && exportedCount > 0 && (
            <a href={resultUrl} target="_blank" rel="noopener noreferrer" className="f2s-btn f2s-btn--secondary f2s-btn--footer f2s-btn--icon-end">
              Open in Slides
              <ArrowUpRightIcon />
            </a>
          )}
        </>
      );
    }
    return null;
  }

  return (
    <>
      {skin === 'win95' && <TitleBar mode={mode} />}

      <header className="f2s-topbar">
        <div className="f2s-topbar-left">
          <div className="f2s-tabs" role="tablist" aria-label="Deck or template">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'deck'}
              className={`f2s-tab${mode === 'deck' ? ' is-active' : ''}`}
              disabled={exporting}
              title={exporting ? 'An export is running. Wait for it to finish before switching modes.' : 'Export a one-off deck to Slides.'}
              onClick={() => setMode('deck')}
            >
              Deck
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'template'}
              className={`f2s-tab${mode === 'template' ? ' is-active' : ''}`}
              disabled={exporting}
              title={exporting ? 'An export is running. Wait for it to finish before switching modes.' : 'Build a reusable Slides template with tagged placeholders.'}
              onClick={() => setMode('template')}
            >
              Templates
            </button>
          </div>
          <div className="f2s-topbar-title-group">
            {/* Un vrai <label> relié au champ : le placeholder seul ne
                donnait aucun nom accessible au champ (WCAG 4.1.2). */}
            <label className="f2s-toolbar-label" htmlFor="f2s-title-input">
              Name:
            </label>
            {mode === 'deck' ? (
              <input
                id="f2s-title-input"
                type="text"
                className="f2s-title-input"
                placeholder="Decker export"
                value={deckTitle}
                onInput={(e) => setDeckTitle((e.target as HTMLInputElement).value)}
              />
            ) : (
              <input
                id="f2s-title-input"
                type="text"
                className="f2s-title-input"
                placeholder="Figma template"
                value={templateTitle}
                onInput={(e) => setTemplateTitle((e.target as HTMLInputElement).value)}
              />
            )}
          </div>
        </div>

        {mode === 'deck' ? (
          <div className="f2s-topbar-actions">
            {renderAddAction(addable.deck, 'deck', handleAddFramesClick)}
            <button
              type="button"
              className="f2s-btn f2s-btn--secondary"
              disabled={exporting || (!hasCanvasSelection && order.length === 0)}
              title={
                exporting
                  ? 'An export is running. Wait for it to finish before changing the deck.'
                  : 'Duplicate and reformat every frame already in the deck (plus any extra selection on the Figma canvas) for Slides, so you can refine them pixel-perfect natively.'
              }
              onClick={handlePrepareForSlides}
            >
              Prepare for Slides
            </button>
            {renderPrimaryActions()}
          </div>
        ) : (
          <div className="f2s-topbar-actions">
            {renderAddAction(addable.template, 'template', handleAddTemplateLayoutClick)}
            <button
              type="button"
              className="f2s-btn f2s-btn--secondary"
              disabled={exporting || (!hasCanvasSelection && templateOrder.length === 0)}
              title={
                exporting
                  ? 'A template creation is running. Wait for it to finish before changing the layouts.'
                  : 'Duplicate and reformat every layout for Slides, clearing most blocking issues (gradients, shadows, letter spacing…) automatically.'
              }
              onClick={handlePrepareTemplateForSlides}
            >
              Prepare for Slides
            </button>
            {renderPrimaryActions()}
          </div>
        )}
      </header>

      <div className="f2s-toolbar">
        <div className="f2s-toolbar-row">
          <div className="f2s-toolbar-group">
            <span className="f2s-toolbar-label">Fonts:</span>
            {(mode === 'deck' ? deckFontSubstitutions : templateFontSubstitutions).length === 0 ? (
              <span className="f2s-toolbar-muted">The fonts of your frames will appear here, ready to replace.</span>
            ) : (
              (mode === 'deck' ? deckFontSubstitutions : templateFontSubstitutions).map((s) => (
                <label
                  className="f2s-font-select"
                  key={s.original}
                  title={
                    s.available
                      ? `Pick another font to use instead of "${s.original}" everywhere in Slides.`
                      : `"${s.original}" isn't available in Slides. Pick the replacement to use.`
                  }
                >
                  <span className="f2s-font-original">{s.original}</span>
                  <span className="f2s-font-arrow">→</span>
                  <FontCombobox
                    value={fontOverrides[s.original] ?? s.resolved}
                    options={AVAILABLE_SLIDES_FONTS}
                    ariaLabel={`Replacement font for "${s.original}"`}
                    onChange={(value) => setFontOverrides((prev) => ({ ...prev, [s.original]: value }))}
                  />
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      {mode === 'deck' ? (
        <DeckPanel
          order={order}
          setOrder={setOrder}
          frames={frames}
          activeId={activeId}
          setActiveId={setActiveId}
          onRemove={removeFrame}
          fontOverrides={fontOverrides}
          exportCursor={exportSource === 'deck' ? exportCursor : undefined}
          exportAttempt={exportSource === 'deck' && exportState !== 'canceled' ? exportAttempt : undefined}
          exportConcluded={exportSource === 'deck' && concludedExport}
          onPacedCursorChange={setPreviewCursor}
          notice={selectionNotice}
          onDismissNotice={clearSelectionNotice}
          locked={exporting}
          failedSlides={failedSlidesHere}
          onPreviewSettled={() => setPreviewSettled(true)}
        />
      ) : (
        <TemplatePanel
          order={templateOrder}
          setOrder={setTemplateOrder}
          layouts={templateLayouts}
          activeId={activeTemplateId}
          setActiveId={setActiveTemplateId}
          notice={templateSelectionNotice}
          onDismissNotice={clearTemplateSelectionNotice}
          locked={exporting}
          failedSlides={failedSlidesHere}
          onPreviewSettled={() => setPreviewSettled(true)}
          onRemove={removeTemplateLayout}
          onRename={renameTemplateLayout}
          onRenameCommit={commitTemplateLayoutRename}
          fontOverrides={fontOverrides}
          exportCursor={exportSource === 'template' ? exportCursor : undefined}
          exportAttempt={exportSource === 'template' && exportState !== 'canceled' ? exportAttempt : undefined}
          exportConcluded={exportSource === 'template' && concludedExport}
          onPacedCursorChange={setPreviewCursor}
          colors={templateColors}
          fonts={templateFonts}
          colorRoles={colorRoles}
          setColorRoles={setColorRoles}
          onNotice={(message) => showTemplateSelectionNotice(message, 'info')}
        />
      )}

      <footer className="f2s-footer">
        <div className="f2s-footer-left">
          <button
            type="button"
            className="f2s-footer-settings"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <GearIcon />
            <span>Settings</span>
          </button>
        </div>
        <div className="f2s-footer-actions">
          {renderExportStatus()}
          {/* Signature et soutien vont ensemble (les deux pointent vers moi) :
              groupés, avec leur propre écart, plus serré que celui du footer. */}
          <div className="f2s-signature">
            <Logo />
            <a href="https://buymeacoffee.com/billelt" target="_blank" rel="noopener noreferrer" className="f2s-coffee-link">
              {/* Le soulignement du survol est tracé sous ce bloc, flèche comprise. */}
              <span className="f2s-coffee-label">
                <span>Buy me a coffee</span>
                <ArrowUpRightIcon size={9} />
              </span>
            </a>
          </div>
        </div>
      </footer>

      <SettingsModal
        open={settingsOpen}
        skin={skin}
        onSkinChange={changeSkin}
        onClose={() => setSettingsOpen(false)}
        signedIn={Boolean(sessionToken)}
        accountEmail={accountEmail}
        onSignOut={handleSignOut}
        showDebugExport={__DEBUG_TOOLS__ && mode === 'deck' && order.length > 0}
        onExportDebugIr={handleExportDebugIr}
        siteUrl={SITE_URL}
      />

      <ResizeGrip />
    </>
  );
}

render(<App />, document.getElementById('app')!);
