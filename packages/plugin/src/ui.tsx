import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ExportOptions, IRDocument } from '@figma-to-slides/shared';
import { sanitizeSessionToken } from './ui/sanitizeSessionToken.js';
import type { ExportCursor } from './ui/exportCursor.js';
import { REVEAL_MS } from './ui/RetroExportPreview.js';
import { AVAILABLE_SLIDES_FONTS } from './serialize/fonts.js';
import {
  DEFAULT_UI_SKIN,
  postToPlugin,
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
import { applyThemeOverride, isThemePreference, readFigmaTheme, watchFigmaTheme, type ThemePreference } from './ui/theme.js';

type AuthPollResult = { status: 'pending' } | { status: 'ready'; sessionToken: string } | { status: 'error'; message: string };

type BackendConfig = { baseUrl: string };
type ExportState = 'idle' | 'exporting' | 'done' | 'error';
type JobConclusion = { status: 'done'; resultUrl: string } | { status: 'failed'; error: string };

/**
 * Temps minimum d'affichage de chaque frame pendant la simulation d'export
 * (beginExportPacing) — calé sur la durée de la révélation rétro
 * (RetroExportPreview) plus une courte pause sur l'image complète, pour
 * qu'on la voie "posée" avant d'enchaîner sur la suivante.
 */
const MIN_SLIDE_VISIBLE_MS = REVEAL_MS + 400;

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

/** Les 8 dents sont générées par rotation autour du centre plutôt que codées
 *  en dur une à une : une seule dent mal recopiée avait rendu l'ancienne
 *  icône asymétrique (elle ressemblait à un soleil, pas à un engrenage). */
const GEAR_TOOTH_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** Icône d'engrenage classique et minimaliste pour le bouton "Settings" du footer. */
function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="1.3" stroke="currentColor" strokeWidth="1.2" />
      {GEAR_TOOTH_ANGLES.map((angle) => (
        <rect
          key={angle}
          x="7.35"
          y="2.75"
          width="1.3"
          height="2.15"
          rx="0.4"
          fill="currentColor"
          transform={`rotate(${angle} 8 8)`}
        />
      ))}
    </svg>
  );
}

/** Trois pistes, chacune coupée par une poignée ronde à une position différente. */
const SLIDER_ROWS = [
  { y: 4, knobX: 6 },
  { y: 8, knobX: 10 },
  { y: 12, knobX: 5 },
];

/** Icône "settings adjust" (curseurs) — alternative à GearIcon, en comparaison le temps de choisir. */
function SlidersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {SLIDER_ROWS.map(({ y, knobX }) => (
        <g key={y}>
          <line x1="1" y1={y} x2={knobX - 2} y2={y} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <line x1={knobX + 2} y1={y} x2="15" y2={y} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx={knobX} cy={y} r="1.8" fill="currentColor" />
        </g>
      ))}
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
  // côté sandbox (clientStorage) et restauré au montage via `skin-restored`.
  const [skin, setSkin] = useState<UiSkin>(DEFAULT_UI_SKIN);

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
  const [templateSelectionNotice, setTemplateSelectionNotice] = useState<string | undefined>();
  const [selecting, setSelecting] = useState(false);
  // TODO.md — pas encore affiché en mode deck : la zone de feedback (notices,
  // erreurs, progression) doit être designée avant d'être réintégrée.
  const [, setSelectionNotice] = useState<string | undefined>();
  const [hasCanvasSelection, setHasCanvasSelection] = useState(false);

  const [sessionToken, setSessionToken] = useState<string | undefined>();
  const [loginError, setLoginError] = useState<string | undefined>();
  const [authUrl, setAuthUrl] = useState<string | undefined>();
  const [backend] = useState<BackendConfig>({ baseUrl: typeof __BACKEND_URL__ === 'string' ? __BACKEND_URL__ : 'https://figma-to-slide-backend.vercel.app' });

  /** Titres saisis par l'utilisateur — deviennent le nom du fichier créé dans Drive (un titre figé rendait chaque export indistinguable du précédent). */
  const [deckTitle, setDeckTitle] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');

  const [settingsOpen, setSettingsOpen] = useState(false);
  // Deux niveaux : le thème de Figma (suivi tant que l'utilisateur n'a rien
  // choisi) et l'override explicite posé depuis la modale de réglages. Le tab
  // menu affiche l'override s'il existe, sinon le thème réellement rendu.
  const [figmaTheme, setFigmaTheme] = useState<ThemePreference>(() => readFigmaTheme());
  const [themeOverride, setThemeOverride] = useState<ThemePreference | undefined>();
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
  // Frame dont le lot est en cours d'application côté backend : c'est elle
  // que le grand aperçu du deck "génère" bande par bande pendant l'export
  // (DeckPanel → RetroExportPreview). Défini dès le clic sur Export, sur la
  // première frame du deck, puis suivi via les lots renvoyés par le polling.
  const [exportCursor, setExportCursor] = useState<ExportCursor | undefined>();
  const pendingAssets = useMemo(() => new Map<string, ArrayBuffer>(), []);

  // Quel mode a démarré l'export en cours, lu depuis `handleExportPayload` —
  // qui vit dans le handler `onMessage` ci-dessous, monté une seule fois
  // (deps: []) et donc figé sur un `exportSource` toujours `undefined` s'il
  // lisait le state directement (même piège que `sessionTokenRef`).
  const exportModeRef = useRef<AppMode | undefined>();
  // Résultat RÉEL du job (done/failed), écrit par `handleExportPayload` une
  // fois le polling conclu. En mode deck, il n'est PAS appliqué directement :
  // la simulation visuelle (beginExportPacing) le lit et ne bascule dessus
  // qu'une fois qu'elle a fini de dérouler toutes les frames — sinon un
  // export plus rapide que l'animation (petit deck, ou lots tous appliqués
  // entre deux pollings) ferait sauter l'aperçu de la 1ère frame directement
  // au résultat, sans jamais montrer les suivantes.
  const jobConclusionRef = useRef<JobConclusion | undefined>();
  const exportPacingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>();

  function stopExportPacing() {
    if (exportPacingTimerRef.current !== undefined) {
      clearTimeout(exportPacingTimerRef.current);
      exportPacingTimerRef.current = undefined;
    }
  }
  useEffect(() => () => stopExportPacing(), []);

  /** Applique une conclusion de job (réelle) à l'état visible : fin d'export, réussie ou non. */
  function applyConclusion(concluded: JobConclusion) {
    setExportCursor(undefined);
    if (concluded.status === 'done') {
      setExportState('done');
      setExportProgress(100);
      setResultUrl(concluded.resultUrl);
    } else {
      setExportState('error');
      setExportError(concluded.error);
    }
  }

  /**
   * Fait défiler `frameIds` dans le grand aperçu (donc dans le rail via
   * `exportCursor`), une frame à la fois et à un rythme fixe
   * (`MIN_SLIDE_VISIBLE_MS`) — indépendant de la vitesse réelle du backend.
   * Ne bascule sur le résultat réel (`jobConclusionRef`) qu'une fois la
   * dernière frame simulée montrée le temps voulu, sauf échec : celui-ci
   * interrompt la simulation tout de suite, inutile de continuer à "faire
   * semblant" de générer les slides restantes.
   */
  function beginExportPacing(frameIds: string[]) {
    stopExportPacing();
    jobConclusionRef.current = undefined;
    const total = frameIds.length;
    if (total === 0) return;

    const step = (index: number) => {
      setExportCursor({ frameId: frameIds[index], index, total });
      setExportProgress(Math.round(((index + 1) / total) * 100));

      const wait = () => {
        exportPacingTimerRef.current = setTimeout(() => {
          const concluded = jobConclusionRef.current;
          if (concluded?.status === 'failed') {
            applyConclusion(concluded);
            return;
          }
          if (index < total - 1) {
            step(index + 1);
            return;
          }
          if (concluded) {
            applyConclusion(concluded);
          } else {
            wait();
          }
        }, MIN_SLIDE_VISIBLE_MS);
      };
      wait();
    };

    step(0);
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
        case 'session-token-restored':
          setSessionToken(sanitizeSessionToken(msg.token as string));
          setAuthUrl(undefined);
          setLoginError(undefined);
          break;
        // Thème forcé depuis la modale de réglages lors d'une session
        // précédente (clientStorage, cf. code.ts).
        case 'theme-preference-restored':
          if (isThemePreference(msg.theme)) setThemeOverride(msg.theme);
          break;
        case 'no-frames-selected':
          if (modeRef.current === 'template') {
            setTemplateSelectionNotice('Select at least one frame on the Figma canvas before clicking.');
          } else {
            setSelectionNotice('Select at least one frame on the Figma canvas before clicking.');
          }
          break;
        case 'too-many-frames':
          if (modeRef.current === 'template') {
            setTemplateSelectionNotice(`${msg.count} layouts selected — a template is capped at ${msg.max} to stay focused.`);
          } else {
            setSelectionNotice(`${msg.count} frames selected — beyond ${msg.max}, export may become slow.`);
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
      const concluded = await pollJob(jobId);
      if (exportModeRef.current === 'deck') {
        // Voir jobConclusionRef : la simulation en cours (démarrée dans
        // startExport) applique elle-même ce résultat une fois qu'elle a
        // fini de dérouler toutes les frames.
        jobConclusionRef.current = concluded;
      } else {
        applyConclusion(concluded);
      }
    } catch (err) {
      stopExportPacing();
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

  /**
   * Sonde `/export/:jobId` jusqu'à conclusion (réussie ou non) et la
   * RENVOIE, sans toucher au state directement : selon le mode (deck ou
   * template), c'est `handleExportPayload` qui décide de l'appliquer tout de
   * suite ou de la confier à la simulation visuelle (voir plus haut).
   */
  async function pollJob(jobId: string): Promise<JobConclusion> {
    try {
      for (let i = 0; i < 120; i++) {
        const res = await fetch(`${backend.baseUrl}/export/${jobId}`, { credentials: 'include' });
        const job = await res.json();
        if (job.status === 'done') {
          return { status: 'done', resultUrl: job.presentationUrl };
        }
        if (job.status === 'failed') {
          // Priorité aux erreurs par slide (`batch.error`) : bien plus
          // actionnables que le message générique de `job.error`, qui ne
          // couvre que l'échec global (ex. la création de présentation
          // elle-même a échoué, avant même le premier lot).
          const batchErrors = (job.batches as { error?: string }[] | undefined)
            ?.map((b) => b.error)
            .filter((e): e is string => Boolean(e));
          return {
            status: 'failed',
            error: batchErrors && batchErrors.length > 0 ? batchErrors.join(' · ') : (job.error ?? 'Unknown server-side failure.'),
          };
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      return {
        status: 'failed',
        error: 'Export timed out after 3 minutes — the presentation may still be processing; check your Google Drive before retrying.',
      };
    } catch (err) {
      return { status: 'failed', error: err instanceof Error ? err.message : String(err) };
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
    if (!sessionToken) startLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signale à code.ts que l'iframe a fini de monter : un `figma.ui.postMessage`
  // envoyé avant ce point (ex. la découverte des frames déjà taguées
  // `slidesExportReady` à la réouverture du plugin, ou la session Google
  // persistée) serait perdu, `postMessage` ne bufferisant rien côté
  // destinataire.
  useEffect(() => {
    postToPlugin({ type: 'ui-ready' });
  }, []);

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
    setSelectionNotice(undefined);
    if (!selecting) {
      setSelecting(true);
      return;
    }
    postToPlugin({ type: 'add-selected-frames' });
    setSelecting(false);
  }

  function removeFrame(id: string) {
    setOrder((prev) => prev.filter((x) => x !== id));
    setFrames((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveId((prev) => (prev === id ? undefined : prev));
  }

  function handleAddTemplateLayoutClick() {
    setTemplateSelectionNotice(undefined);
    if (!templateSelecting) {
      setTemplateSelecting(true);
      return;
    }
    postToPlugin({ type: 'add-template-layout' });
    setTemplateSelecting(false);
  }

  function removeTemplateLayout(id: string) {
    setTemplateOrder((prev) => prev.filter((x) => x !== id));
    setTemplateLayouts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveTemplateId((prev) => (prev === id ? undefined : prev));
  }

  function startExport() {
    setExportState('exporting');
    setExportProgress(0);
    setExportSource('deck');
    exportModeRef.current = 'deck';
    // L'aperçu rétro démarre dès le clic et défile ensuite toutes les frames
    // du deck à un rythme fixe (voir beginExportPacing) : la sérialisation
    // puis l'upload des assets prennent déjà plusieurs secondes avant que le
    // premier lot n'existe côté backend, et le job réel peut ensuite conclure
    // bien plus vite que cette simulation (petit deck, ou lots tous appliqués
    // entre deux pollings) — dans les deux cas l'utilisateur voit chaque
    // slide "s'imprimer" au lieu de ne voir que la première suivie d'un saut
    // direct au résultat.
    beginExportPacing(order);
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
    // Coupe une éventuelle simulation d'export deck encore en vol : sans ça,
    // son timer en attente pourrait appliquer plus tard le résultat de
    // L'ANCIEN job deck par-dessus l'état du nouvel export template.
    stopExportPacing();
    setExportState('exporting');
    setExportProgress(0);
    setExportSource('template');
    exportModeRef.current = 'template';
    setExportCursor(undefined);
    postToPlugin({
      type: 'request-template',
      includedFrameIds: templateOrder,
      order: templateOrder,
      presentationTitle: templateTitle.trim() || 'Figma template',
      fontOverrides,
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
      // commentaire de startLogin sur la CSP du plugin Figma.
      return (
        <a href={authUrl} target="_blank" rel="noreferrer" className="f2s-btn f2s-btn--primary" title={`Connect your Google account to enable "${label}".`}>
          Sign in with Google
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
    // TODO(TODO.md) : état de chargement pendant qu'on attend le lien
    // Google — pour l'instant juste désactivé, sans feedback visuel.
    return (
      <button type="button" className="f2s-btn f2s-btn--primary" disabled>
        Sign in with Google
      </button>
    );
  }

  return (
    <>
      {skin === 'win95' && <TitleBar mode={mode} />}

      <header className="f2s-topbar">
        <div className="f2s-topbar-left">
          <Logo />
          <button
            type="button"
            className="f2s-btn f2s-btn--secondary"
            onClick={() => setMode((m) => (m === 'deck' ? 'template' : 'deck'))}
            title={mode === 'deck' ? 'Build a reusable Slides template with tagged placeholders.' : 'Back to exporting a one-off deck.'}
          >
            {mode === 'deck' ? 'Create a template' : 'Back to deck export'}
          </button>
        </div>

        {mode === 'deck' ? (
          <div className="f2s-topbar-actions">
            <button type="button" className="f2s-btn f2s-btn--tertiary" onClick={handleAddFramesClick}>
              {selecting ? 'Add selection' : 'Select frames to add'}
            </button>
            <button
              type="button"
              className="f2s-btn f2s-btn--secondary"
              disabled={!hasCanvasSelection && order.length === 0}
              title="Duplicate and reformat every frame already in the deck (plus any extra selection on the Figma canvas) for Slides, so you can refine them pixel-perfect natively."
              onClick={handlePrepareForSlides}
            >
              Prepare for Slides
            </button>
            {renderPrimaryAction('Export', exporting || order.length === 0, busyFromOtherMode ? busyTitle : undefined, startExport)}
          </div>
        ) : (
          <div className="f2s-topbar-actions">
            <button type="button" className="f2s-btn f2s-btn--tertiary" onClick={handleAddTemplateLayoutClick}>
              {templateSelecting ? 'Add selection' : 'Select layout to add'}
            </button>
            <button
              type="button"
              className="f2s-btn f2s-btn--secondary"
              disabled={!hasCanvasSelection && templateOrder.length === 0}
              title="Duplicate and reformat every layout for Slides — clears most blocking issues (gradients, shadows, letter spacing…) automatically."
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
            <span className="f2s-toolbar-label">{mode === 'deck' ? 'Deck name:' : 'Template name:'}</span>
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
          exportCursor={exporting && exportSource === 'deck' ? exportCursor : undefined}
        />
      ) : (
        <TemplatePanel
          order={templateOrder}
          layouts={templateLayouts}
          activeId={activeTemplateId}
          setActiveId={setActiveTemplateId}
          selecting={templateSelecting}
          hasCanvasSelection={hasCanvasSelection}
          notice={templateSelectionNotice}
          onRemove={removeTemplateLayout}
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
        {/* TODO comparaison temporaire : à retirer une fois l'icône retenue entre GearIcon et SlidersIcon. */}
        <button
          type="button"
          className="f2s-footer-settings"
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <SlidersIcon />
          <span>Settings adjust</span>
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
          <a href="#" className="f2s-btn f2s-btn--tertiary">
            Support me with Ko-fi
          </a>
          {exportState === 'done' && exportSource === mode && resultUrl && (
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
      />
    </>
  );
}

render(<App />, document.getElementById('app')!);
