import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ExportOptions, IRDocument, ThemeColorRole } from '@figma-to-slides/shared';
import { sanitizeSessionToken } from './ui/sanitizeSessionToken.js';
import { exportCursorFromBatches, type ExportBatch, type ExportCursor } from './ui/exportCursor.js';
import { AVAILABLE_SLIDES_FONTS } from './serialize/fonts.js';
import { aggregateColorSwatches, aggregateFontUsages } from './serialize/templateSummary.js';
import {
  postToPlugin,
  readInitialSkin,
  skinClassName,
  type AppMode,
  type FontSubstitution,
  type FrameCandidate,
  type FrameState,
  type FrameWarning,
  type TemplateColorSwatch,
  type TemplateFontUsage,
  type TemplateLayoutState,
  type TemplatePlaceholder,
  type TemplateWarning,
  type UiSkin,
} from './ui/types.js';
import { DeckPanel } from './ui/DeckPanel';
import { TemplatePanel } from './ui/TemplatePanel';
import { SettingsModal } from './ui/SettingsModal';
import {
  applyThemeOverride,
  isThemePreference,
  readFigmaTheme,
  readInitialThemeOverride,
  watchFigmaTheme,
  type ThemePreference,
} from './ui/theme.js';

type AuthPollResult = { status: 'pending' } | { status: 'ready'; sessionToken: string } | { status: 'error'; message: string };

type BackendConfig = { baseUrl: string };
type ExportState = 'idle' | 'exporting' | 'done' | 'error';
type JobConclusion =
  | { status: 'done'; resultUrl: string }
  | {
      status: 'failed';
      error: string;
      /** Présente dès que la présentation a été créée, même en cas d'échec partiel — la présentation existe déjà côté Drive. */
      resultUrl: string | undefined;
      /** id (`sourceNodeId`, == id du nœud Figma) des slides dont le lot a échoué — pour le bouton "Retry" ciblé. */
      failedFrameIds: string[];
      /** Un job avec une présentation créée et au moins un lot encore non appliqué peut être repris via POST /export/:jobId/retry. */
      retryable: boolean;
    };

/** Cadence de polling `/export/:jobId` pendant un export — pilote directement la progression affichée, plus de simulation temporelle. */
const POLL_INTERVAL_MS = 1000;
/** Abandon du polling au-delà de cette durée totale (la présentation peut malgré tout avoir été créée — voir `pollJob`). */
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

/** Durée d'affichage d'une notice de sélection (toast deck) avant auto-dismiss. */
const SELECTION_NOTICE_MS = 4000;

// Injectés au build (voir esbuild.config.mjs).
declare const __BACKEND_URL__: string;
declare const __LOGO_SVG__: string;

/** Le backend a répondu 401 : la session Google persistée n'est plus valide — à purger avant de relancer la connexion. */
class AuthExpiredError extends Error {
  constructor() {
    super('Your Google session has expired — sign in again, then retry.');
  }
}

/** Monogramme "B" — assets/logo.svg (depuis la racine du projet). */
function Logo() {
  return (
    <a href="https://billeltighidet.fr" target="_blank" rel="noreferrer" title="billeltighidet.fr">
      <div className="f2s-logo" dangerouslySetInnerHTML={{ __html: __LOGO_SVG__ }} />
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
      width="16"
      height="16"
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

/** Barre de titre du skin Windows 95 : la fenêtre du plugin en devient une vraie fenêtre 95. */
function TitleBar({ mode }: { mode: AppMode }) {
  return (
    <div className="f2s-titlebar">
      <span className="f2s-titlebar-text">Figma → Slides — {mode === 'deck' ? 'Deck export' : 'Template creation'}</span>
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

  // Habillage de l'UI — Windows 95 par défaut, l'habillage du design system
  // ("modern") restant accessible depuis le footer. Le choix est persisté
  // côté sandbox (clientStorage) : code.ts pose déjà la bonne classe sur
  // <html> avant même le montage de React (voir `readInitialSkin`), donc
  // c'est de là que part l'état initial — pas de `DEFAULT_UI_SKIN` qu'un
  // premier rendu afficherait avant que `skin-restored` n'arrive.
  const [skin, setSkin] = useState<UiSkin>(() => readInitialSkin());

  // Les deux feuilles de style scopent leurs règles sur cette classe : elle
  // vit sur <html> plutôt que sur #app pour pouvoir aussi repeindre le fond
  // du document et les ascenseurs.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(skinClassName('win95'), skin === 'win95');
    root.classList.toggle(skinClassName('modern'), skin === 'modern');
    root.classList.toggle(skinClassName('hybrid'), skin === 'hybrid');
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
  const [templateSelecting, setTemplateSelecting] = useState(false);
  // Notice de sélection du mode template ("no-frames-selected" / "too-many-frames") :
  // même toast absolu que le mode deck (voir `selectionNotice` ci-dessous) —
  // avant, c'était un texte rouge inline en tête du rail, incohérent avec le
  // mode deck et sans auto-dismiss.
  const [templateSelectionNotice, setTemplateSelectionNotice] = useState<string | undefined>();
  const templateSelectionNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>();

  function showTemplateSelectionNotice(message: string) {
    if (templateSelectionNoticeTimerRef.current !== undefined) clearTimeout(templateSelectionNoticeTimerRef.current);
    setTemplateSelectionNotice(message);
    templateSelectionNoticeTimerRef.current = setTimeout(() => setTemplateSelectionNotice(undefined), SELECTION_NOTICE_MS);
  }

  function clearTemplateSelectionNotice() {
    if (templateSelectionNoticeTimerRef.current !== undefined) {
      clearTimeout(templateSelectionNoticeTimerRef.current);
      templateSelectionNoticeTimerRef.current = undefined;
    }
    setTemplateSelectionNotice(undefined);
  }

  const [selecting, setSelecting] = useState(false);
  // Notice de sélection du mode deck ("no-frames-selected" / "too-many-frames") :
  // affichée en toast absolu par DeckPanel (pas de zone dédiée dans le layout
  // du rail) — auto-dismiss après SELECTION_NOTICE_MS.
  const [selectionNotice, setSelectionNotice] = useState<string | undefined>();
  const selectionNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>();

  function showSelectionNotice(message: string) {
    if (selectionNoticeTimerRef.current !== undefined) clearTimeout(selectionNoticeTimerRef.current);
    setSelectionNotice(message);
    selectionNoticeTimerRef.current = setTimeout(() => setSelectionNotice(undefined), SELECTION_NOTICE_MS);
  }

  function clearSelectionNotice() {
    if (selectionNoticeTimerRef.current !== undefined) {
      clearTimeout(selectionNoticeTimerRef.current);
      selectionNoticeTimerRef.current = undefined;
    }
    setSelectionNotice(undefined);
  }

  useEffect(
    () => () => {
      if (selectionNoticeTimerRef.current !== undefined) clearTimeout(selectionNoticeTimerRef.current);
      if (templateSelectionNoticeTimerRef.current !== undefined) clearTimeout(templateSelectionNoticeTimerRef.current);
    },
    [],
  );
  const [hasCanvasSelection, setHasCanvasSelection] = useState(false);

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
  const [backend] = useState<BackendConfig>({ baseUrl: typeof __BACKEND_URL__ === 'string' ? __BACKEND_URL__ : 'https://figma-to-slide-backend.vercel.app' });

  /** Titres saisis par l'utilisateur — deviennent le nom du fichier créé dans Drive (un titre figé rendait chaque export indistinguable du précédent). */
  const [deckTitle, setDeckTitle] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');

  const [settingsOpen, setSettingsOpen] = useState(false);
  // Deux niveaux : le thème de Figma (suivi tant que l'utilisateur n'a rien
  // choisi) et l'override explicite posé depuis la modale de réglages. Le tab
  // menu affiche l'override s'il existe, sinon le thème réellement rendu.
  // `themeOverride` part de la classe déjà posée par code.ts sur <html>
  // avant le montage (voir `readInitialThemeOverride`), pas de `undefined` —
  // sinon un thème forcé s'afficherait d'abord dans le thème de Figma avant
  // de basculer une fois `theme-preference-restored` reçu.
  const [figmaTheme, setFigmaTheme] = useState<ThemePreference>(() => readFigmaTheme());
  const [themeOverride, setThemeOverride] = useState<ThemePreference | undefined>(() => readInitialThemeOverride());
  const theme = themeOverride ?? figmaTheme;

  useEffect(() => watchFigmaTheme(setFigmaTheme), []);
  useEffect(() => applyThemeOverride(themeOverride), [themeOverride]);

  function handleThemeChange(next: ThemePreference) {
    setThemeOverride(next);
    // Persisté côté sandbox (clientStorage) : l'iframe UI n'a aucun stockage
    // durable, le choix serait perdu à chaque réouverture du plugin.
    postToPlugin({ type: 'save-theme-preference', theme: next });
  }

  useEffect(() => {
    if (!activeId && order.length > 0) setActiveId(order[0]);
  }, [order, activeId]);

  useEffect(() => {
    if (!activeTemplateId && templateOrder.length > 0) setActiveTemplateId(templateOrder[0]);
  }, [templateOrder, activeTemplateId]);

  /** Déduplique les substitutions de police sur tout le deck, dans l'ordre d'apparition des frames. */
  const deckFontSubstitutions = useMemo(() => {
    const seen = new Set<string>();
    const subs: FontSubstitution[] = [];
    for (const id of order) {
      for (const s of frames[id]?.fontSubstitutions ?? []) {
        const key = `${s.original}→${s.resolved}`;
        if (seen.has(key)) continue;
        seen.add(key);
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
        const key = `${s.original}→${s.resolved}`;
        if (seen.has(key)) continue;
        seen.add(key);
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
  /** Hex tapé à la main pour un rôle dans l'onglet Style, prioritaire sur la couleur détectée assignée via `colorRoles` (voir `serialize/templateTheme.ts::resolveThemeRoleHexes`). */
  const [roleColorOverrides, setRoleColorOverrides] = useState<Partial<Record<ThemeColorRole, string>>>({});
  const templateColors = useMemo(
    () => aggregateColorSwatches(templateOrder.map((id) => templateLayouts[id]?.colors ?? [])),
    [templateOrder, templateLayouts],
  );
  const templateFonts = useMemo(
    () => aggregateFontUsages(templateOrder.map((id) => templateLayouts[id]?.fonts ?? [])),
    [templateOrder, templateLayouts],
  );

  /** Choix manuel de l'utilisateur (police originale → police Slides), envoyé à l'export pour remplacer la résolution par défaut. */
  const [fontOverrides, setFontOverrides] = useState<Record<string, string>>({});

  const [exportState, setExportState] = useState<ExportState>('idle');
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
  // Slides dont le dernier lot a échoué (sourceNodeId == id du nœud Figma) —
  // pour lister/surligner précisément lesquelles côté rapport, et cibler le retry.
  const [failedFrameIds, setFailedFrameIds] = useState<string[]>([]);
  // Le job a une présentation créée et au moins un lot encore non appliqué :
  // POST /export/:jobId/retry peut rejouer UNIQUEMENT ces lots-là plutôt que
  // de forcer à ressoumettre tout le deck.
  const [retryable, setRetryable] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const pendingAssets = useMemo(() => new Map<string, ArrayBuffer>(), []);

  /** Applique une conclusion de job (réelle) à l'état visible : fin d'export, réussie ou non. */
  function applyConclusion(concluded: JobConclusion) {
    setExportCursor(undefined);
    if (concluded.status === 'done') {
      setExportState('done');
      setExportProgress(100);
      setResultUrl(concluded.resultUrl);
      setFailedFrameIds([]);
      setRetryable(false);
    } else {
      setExportState('error');
      setExportError(concluded.error);
      setResultUrl(concluded.resultUrl);
      setFailedFrameIds(concluded.failedFrameIds);
      setRetryable(concluded.retryable);
    }
  }

  /** Progression (0–100) déduite du nombre de lots réellement conclus (`applied`/`failed`) sur le total — jamais simulée. */
  function progressFromBatches(batches: ExportBatch[] | undefined): number {
    if (!batches || batches.length === 0) return 0;
    const settled = batches.filter((b) => b.status !== 'pending').length;
    return Math.round((settled / batches.length) * 100);
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
              placeholders: (msg.placeholders as TemplatePlaceholder[]) ?? [],
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
                    placeholders: (msg.placeholders as TemplatePlaceholder[]) ?? [],
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
          break;
        // Habillage persisté via clientStorage (code.ts) : sans stockage
        // durable dans l'iframe UI, c'est le seul moyen que le choix
        // survive à la fermeture du plugin.
        case 'skin-restored':
          if (msg.skin === 'win95' || msg.skin === 'modern' || msg.skin === 'hybrid') setSkin(msg.skin);
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
        // Thème forcé depuis la modale de réglages lors d'une session
        // précédente (clientStorage, cf. code.ts).
        case 'theme-preference-restored':
          if (isThemePreference(msg.theme)) setThemeOverride(msg.theme);
          break;
        case 'no-frames-selected':
          if (modeRef.current === 'template') {
            showTemplateSelectionNotice('Select at least one frame on the Figma canvas before clicking.');
          } else {
            showSelectionNotice('Select at least one frame on the Figma canvas before clicking.');
          }
          break;
        case 'too-many-frames':
          if (modeRef.current === 'template') {
            showTemplateSelectionNotice(`${msg.count} layouts selected — a template is capped at ${msg.max} to stay focused.`);
          } else {
            showSelectionNotice(`${msg.count} frames selected — beyond ${msg.max}, export may become slow.`);
          }
          break;
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
      const res = await fetch(`${backend.baseUrl}/assets`, {
        method: 'POST',
        body: form,
        headers: sessionTokenRef.current ? { Authorization: `Bearer ${sessionTokenRef.current}` } : undefined,
        credentials: 'include',
      });
      if (res.status === 401) throw new AuthExpiredError();
      if (!res.ok) {
        const body = await res.json().catch(() => undefined);
        throw new Error(body?.error ? `${body.error} (${res.status})` : `Asset upload rejected (${res.status})`);
      }
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
    throw new Error(`${missing} image asset(s) never arrived from Figma — close and reopen the plugin, then retry.`);
  }

  async function handleExportPayload(doc: IRDocument, expectedAssetKeys: string[]) {
    setExportState('exporting');
    setExportProgress(0);
    setExportError(undefined);
    try {
      // Purge des assets d'un export précédent (ou de frames retirées depuis)
      // encore bufferisés : sans ça, chaque nouvel export ré-uploadait tout
      // l'historique de la session.
      const expected = new Set(expectedAssetKeys);
      for (const key of [...pendingAssets.keys()]) {
        if (!expected.has(key)) pendingAssets.delete(key);
      }
      await waitForExpectedAssets(expectedAssetKeys);
      await uploadAssetBatches(expectedAssetKeys.map((k) => [k, pendingAssets.get(k)!]));
      pendingAssets.clear();

      const form = new FormData();
      form.append('document', JSON.stringify(doc));

      const res = await fetch(`${backend.baseUrl}/export`, {
        method: 'POST',
        body: form,
        headers: sessionTokenRef.current ? { Authorization: `Bearer ${sessionTokenRef.current}` } : undefined,
        credentials: 'include',
      });
      if (res.status === 401) throw new AuthExpiredError();
      if (!res.ok) {
        const body = await res.json().catch(() => undefined);
        throw new Error(body?.error ? `${body.error} (${res.status})` : `Export rejected (${res.status})`);
      }
      const { jobId } = await res.json();
      setExportJobId(jobId);
      const concluded = await pollJob(jobId, applyLiveBatches);
      applyConclusion(concluded);
    } catch (err) {
      setExportState('error');
      setExportCursor(undefined);
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

  /** Lots `failed` d'un poll `/export/:jobId`, sous la forme utilisée par `JobConclusion`. */
  function failedIdsFrom(batches: ExportBatch[] | undefined): string[] {
    return (batches ?? []).filter((b) => b.status === 'failed').map((b) => b.sourceSlideId);
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
          return { status: 'done', resultUrl: job.presentationUrl };
        }
        if (job.status === 'failed') {
          // Priorité aux erreurs par slide (`batch.error`) : bien plus
          // actionnables que le message générique de `job.error`, qui ne
          // couvre que l'échec global (ex. la création de présentation
          // elle-même a échoué, avant même le premier lot).
          const batchErrors = batches?.map((b) => b.error).filter((e): e is string => Boolean(e));
          const failedFrameIds = failedIdsFrom(batches);
          return {
            status: 'failed',
            error: batchErrors && batchErrors.length > 0 ? batchErrors.join(' · ') : (job.error ?? 'Unknown server-side failure.'),
            resultUrl: job.presentationUrl,
            failedFrameIds,
            retryable: Boolean(job.presentationId) && failedFrameIds.length > 0,
          };
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      // Le job continue peut-être de tourner côté serveur au-delà de ce délai
      // (waitUntil n'a pas de limite propre) : si une présentation a déjà été
      // créée, on la propose quand même plutôt que de ne rien montrer.
      return {
        status: 'failed',
        error: 'Export timed out after 3 minutes — the presentation may still be processing; check your Google Drive, or retry once it settles.',
        resultUrl: lastPresentationUrl,
        failedFrameIds: [],
        retryable: Boolean(lastPresentationId),
      };
    } catch (err) {
      return {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        resultUrl: lastPresentationUrl,
        failedFrameIds: [],
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
    setExportState('exporting');
    setExportError(undefined);
    try {
      const res = await fetch(`${backend.baseUrl}/export/${exportJobId}/retry`, {
        method: 'POST',
        headers: sessionTokenRef.current ? { Authorization: `Bearer ${sessionTokenRef.current}` } : undefined,
        credentials: 'include',
      });
      if (res.status === 401) throw new AuthExpiredError();
      if (!res.ok) {
        const body = await res.json().catch(() => undefined);
        throw new Error(body?.error ? `${body.error} (${res.status})` : `Retry rejected (${res.status})`);
      }
      const concluded = await pollJob(exportJobId, applyLiveBatches);
      applyConclusion(concluded);
    } catch (err) {
      setExportState('error');
      setExportCursor(undefined);
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
          setLoginError(result.message);
          setAuthUrl(undefined);
          return;
        }
      } catch {
        // Coupure réseau transitoire : on retente au prochain tour plutôt
        // que d'abandonner tout de suite.
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setLoginError('Sign-in timed out — try again.');
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
    fetch(`${backend.baseUrl}/auth/google`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => undefined);
          throw new Error(body?.message ?? `Backend responded ${res.status}`);
        }
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

  function handleAddFramesClick() {
    clearSelectionNotice();
    if (!selecting) {
      setSelecting(true);
      return;
    }
    postToPlugin({ type: 'add-selected-frames' });
    setSelecting(false);
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
    if (!templateSelecting) {
      setTemplateSelecting(true);
      return;
    }
    postToPlugin({ type: 'add-template-layout' });
    setTemplateSelecting(false);
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

  function startExport() {
    setExportState('exporting');
    setExportProgress(0);
    setExportSource('deck');
    setExportCursor(undefined);
    setExportJobId(undefined);
    setFailedFrameIds([]);
    setRetryable(false);
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
      presentationTitle: deckTitle.trim() || 'Figma → Slides export',
      fontOverrides,
    });
  }

  /**
   * Réutilise le MÊME pipeline d'export que le deck : côté backend, un
   * template n'est jamais qu'une présentation dont chaque slide est un
   * layout réutilisable — mêmes endpoints `/assets` + `/export`.
   */
  function startTemplateCreate() {
    setExportState('exporting');
    setExportProgress(0);
    setExportSource('template');
    setExportCursor(undefined);
    setExportJobId(undefined);
    setFailedFrameIds([]);
    setRetryable(false);
    postToPlugin({
      type: 'request-template',
      includedFrameIds: templateOrder,
      order: templateOrder,
      presentationTitle: templateTitle.trim() || 'Figma template',
      fontOverrides,
      colorRoles,
      roleColorOverrides,
    });
  }

  const exporting = exportState === 'exporting';
  // Le pipeline d'export (assets bufferisés, polling) est partagé : un seul
  // export à la fois, mais le mode qui n'a PAS lancé l'export en cours
  // explique pourquoi son bouton attend au lieu d'être grisé sans raison.
  const busyFromOtherMode = exporting && exportSource !== undefined && exportSource !== mode;
  const busyTitle = exportSource === 'deck' ? 'A deck export is still running — wait for it to finish.' : 'A template creation is still running — wait for it to finish.';

  /** Bouton d'action principal (Export / Create template) ou, si la session Google n'existe pas encore, le flow de connexion — même wording dans les deux modes : le lien dit ce qu'il fait ("Sign in with Google"), plus de bouton "Export" qui ouvre en réalité l'OAuth. */
  function renderPrimaryAction(label: string, disabled: boolean, disabledTitle: string | undefined, onClick: () => void) {
    if (sessionToken) {
      return (
        <button type="button" className="f2s-btn f2s-btn--primary" disabled={disabled} title={disabledTitle} onClick={onClick}>
          {label}
        </button>
      );
    }
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
          title={authLinkClicked ? 'Finish signing in with Google in the browser tab — click again to reopen it if you closed it.' : `Connect your Google account to enable "${label}".`}
          onClick={() => setAuthLinkClicked(true)}
        >
          {authLinkClicked ? (
            <span className="f2s-btn-loading">
              <span className="f2s-spinner" aria-hidden="true" />
              Waiting for Google sign-in…
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

  return (
    <>
      {skin === 'win95' && <TitleBar mode={mode} />}

      <header className="f2s-topbar">
        <div className="f2s-topbar-left">
          <Logo />
          <div className="f2s-tabs" role="tablist" aria-label="Deck or template">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'deck'}
              className={`f2s-tab${mode === 'deck' ? ' is-active' : ''}`}
              disabled={exporting}
              title={exporting ? 'An export is running — wait for it to finish before switching modes.' : 'Export a one-off deck to Slides.'}
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
              title={exporting ? 'An export is running — wait for it to finish before switching modes.' : 'Build a reusable Slides template with tagged placeholders.'}
              onClick={() => setMode('template')}
            >
              Templates
            </button>
          </div>
          <div className="f2s-topbar-title-group">
            <span className="f2s-toolbar-label">Name:</span>
            {mode === 'deck' ? (
              <input
                type="text"
                className="f2s-title-input"
                placeholder="Figma → Slides export"
                value={deckTitle}
                onInput={(e) => setDeckTitle((e.target as HTMLInputElement).value)}
              />
            ) : (
              <input
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
            <button
              type="button"
              className="f2s-btn f2s-btn--tertiary"
              disabled={exporting}
              title={exporting ? 'An export is running — wait for it to finish before changing the deck.' : undefined}
              onClick={handleAddFramesClick}
            >
              {selecting ? 'Add selection' : 'Select frames to add'}
            </button>
            <button
              type="button"
              className="f2s-btn f2s-btn--secondary"
              disabled={exporting || (!hasCanvasSelection && order.length === 0)}
              title={
                exporting
                  ? 'An export is running — wait for it to finish before changing the deck.'
                  : 'Duplicate and reformat every frame already in the deck (plus any extra selection on the Figma canvas) for Slides, so you can refine them pixel-perfect natively.'
              }
              onClick={handlePrepareForSlides}
            >
              Prepare for Slides
            </button>
            {renderPrimaryAction('Export', exporting || order.length === 0, busyFromOtherMode ? busyTitle : undefined, startExport)}
          </div>
        ) : (
          <div className="f2s-topbar-actions">
            <button
              type="button"
              className="f2s-btn f2s-btn--tertiary"
              disabled={exporting}
              title={exporting ? 'A template creation is running — wait for it to finish before changing the layouts.' : undefined}
              onClick={handleAddTemplateLayoutClick}
            >
              {templateSelecting ? 'Add selection' : 'Select layout to add'}
            </button>
            <button
              type="button"
              className="f2s-btn f2s-btn--secondary"
              disabled={exporting || (!hasCanvasSelection && templateOrder.length === 0)}
              title={
                exporting
                  ? 'A template creation is running — wait for it to finish before changing the layouts.'
                  : 'Duplicate and reformat every layout for Slides — clears most blocking issues (gradients, shadows, letter spacing…) automatically.'
              }
              onClick={handlePrepareTemplateForSlides}
            >
              Prepare for Slides
            </button>
            {renderPrimaryAction(
              'Create template',
              exporting || templateOrder.length === 0 || templateHasBlockingLayout,
              busyFromOtherMode ? busyTitle : templateHasBlockingLayout ? 'Fix the blocking issues listed below before creating the template.' : undefined,
              startTemplateCreate,
            )}
          </div>
        )}
      </header>

      <div className="f2s-toolbar">
        <div className="f2s-toolbar-row">
          <div className="f2s-toolbar-group">
            <span className="f2s-toolbar-label">Fonts:</span>
            {(mode === 'deck' ? deckFontSubstitutions : templateFontSubstitutions).length === 0 ? (
              <span className="f2s-toolbar-muted">All fonts will appear here and can be replaced automatically.</span>
            ) : (
              (mode === 'deck' ? deckFontSubstitutions : templateFontSubstitutions).map((s) => (
                <label className="f2s-font-select" key={s.original} title={`"${s.original}" isn't available in Slides — pick the replacement to use.`}>
                  <span className="f2s-font-original">{s.original}</span>
                  <span className="f2s-font-arrow">→</span>
                  <select
                    className="f2s-font-dropdown"
                    value={fontOverrides[s.original] ?? s.resolved}
                    onChange={(e) => {
                      const value = (e.target as HTMLSelectElement).value;
                      setFontOverrides((prev) => ({ ...prev, [s.original]: value }));
                    }}
                  >
                    {AVAILABLE_SLIDES_FONTS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
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
          selecting={selecting}
          hasCanvasSelection={hasCanvasSelection}
          onRemove={removeFrame}
          fontOverrides={fontOverrides}
          exportCursor={exporting && exportSource === 'deck' ? exportCursor : undefined}
          notice={selectionNotice}
        />
      ) : (
        <TemplatePanel
          order={templateOrder}
          setOrder={setTemplateOrder}
          layouts={templateLayouts}
          activeId={activeTemplateId}
          setActiveId={setActiveTemplateId}
          selecting={templateSelecting}
          hasCanvasSelection={hasCanvasSelection}
          notice={templateSelectionNotice}
          onRemove={removeTemplateLayout}
          onRename={renameTemplateLayout}
          fontOverrides={fontOverrides}
          exportCursor={exporting && exportSource === 'template' ? exportCursor : undefined}
          colors={templateColors}
          fonts={templateFonts}
          colorRoles={colorRoles}
          setColorRoles={setColorRoles}
          roleColorOverrides={roleColorOverrides}
          setRoleColorOverrides={setRoleColorOverrides}
        />
      )}

      <footer className="f2s-footer">
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
        <div className="f2s-footer-actions">
          {/* Sans ce message, un export échoué (session expirée, 400 Slides
              API, backend injoignable…) redevenait totalement silencieux :
              l'aperçu rétro s'arrêtait, exportError était bien renseigné,
              mais rien ne le lisait — l'utilisateur ne voyait ni lien ni
              erreur. Voir TODO.md « Affichage des erreurs ». */}
          {exportState === 'error' && exportSource === mode && exportError && (
            <p className="f2s-error f2s-footer-error" title={exportError}>
              {exportError}
            </p>
          )}
          <a href="https://ko-fi.com/billelt" target="_blank" rel="noreferrer" className="f2s-btn f2s-btn--tertiary">
            Support me with Ko-fi
          </a>
          {/* Reprise ciblée (backend jobs/runner.ts `retryExportJob`) : ne
              rejoue QUE les slides encore en échec, jamais tout le deck — la
              présentation déjà créée (et les slides déjà réussies) reste
              intacte pendant l'attente. */}
          {exportState === 'error' && exportSource === mode && retryable && (
            <button type="button" className="f2s-btn f2s-btn--secondary" disabled={retrying} onClick={handleRetryFailedSlides}>
              {retrying ? 'Retrying…' : `Retry ${failedFrameIds.length} failed slide${failedFrameIds.length === 1 ? '' : 's'}`}
            </button>
          )}
          {/* La présentation existe dès qu'elle a été créée, même en cas
              d'échec partiel (certains lots appliqués, d'autres non) — un
              lien vers un travail déjà là vaut mieux qu'un simple message
              d'erreur qui le cache. */}
          {(exportState === 'done' || exportState === 'error') && exportSource === mode && resultUrl && (
            <a href={resultUrl} target="_blank" rel="noreferrer" className="f2s-btn f2s-btn--primary">
              Open presentation
            </a>
          )}
        </div>
      </footer>

      <SettingsModal
        open={settingsOpen}
        theme={theme}
        onThemeChange={handleThemeChange}
        skin={skin}
        onSkinChange={changeSkin}
        onClose={() => setSettingsOpen(false)}
        signedIn={Boolean(sessionToken)}
        accountEmail={accountEmail}
        onSignOut={handleSignOut}
        showDebugExport={mode === 'deck' && order.length > 0}
        onExportDebugIr={handleExportDebugIr}
      />
    </>
  );
}

render(<App />, document.getElementById('app')!);
