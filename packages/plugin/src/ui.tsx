import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ExportOptions, IRDocument } from '@figma-to-slides/shared';
import { sanitizeSessionToken } from './ui/sanitizeSessionToken.js';
import { moveToIndex } from './ui/reorderFrames.js';
import { AVAILABLE_SLIDES_FONTS } from './serialize/fonts.js';

type AuthPollResult = { status: 'pending' } | { status: 'ready'; sessionToken: string } | { status: 'error'; message: string };

interface FrameCandidate {
  id: string;
  name: string;
  width: number;
  height: number;
}

interface FontSubstitution {
  original: string;
  resolved: string;
}

interface FrameState extends FrameCandidate {
  previewDataUrl?: string;
  fontSubstitutions?: FontSubstitution[];
}

type BackendConfig = { baseUrl: string };
type ExportState = 'idle' | 'exporting' | 'done' | 'error';

/**
 * Rapport de contenu communicable (brief-creation-template-google-slides.md
 * — "focus d'abord sur le fonctionnement... couleurs, typos, layouts
 * notamment avec les placeholders"), calculé côté sandbox
 * (serialize/templateValidation.ts, serialize/templateSummary.ts) et
 * transporté tel quel jusqu'à l'UI.
 */
type WarningSeverity = 'info' | 'warning' | 'blocking';
interface TemplateWarning {
  code: string;
  severity: WarningSeverity;
  sourceNodeId: string;
  nodeName: string;
  message: string;
}
interface TemplatePlaceholder {
  id: string;
  sourceNodeId: string;
  role: string;
  label: string;
}
interface TemplateColorSwatch {
  hex: string;
  alpha: number;
  usageCount: number;
}
interface TemplateFontUsage {
  family: string;
  weights: number[];
}

interface TemplateLayoutState extends FrameCandidate {
  previewDataUrl?: string;
  warnings: TemplateWarning[];
  blocking: boolean;
  placeholders: TemplatePlaceholder[];
  colors: TemplateColorSwatch[];
  fonts: TemplateFontUsage[];
  fontSubstitutions?: FontSubstitution[];
}

type AppMode = 'deck' | 'template';

// Injecté au build (voir esbuild.config.mjs) ou saisi manuellement par
// l'utilisateur au premier lancement — stocké via figma.clientStorage
// (spec §7.2, réutilisé ici pour la config backend).
declare const __BACKEND_URL__: string;

function postToPlugin(message: Record<string, unknown>): void {
  parent.postMessage({ pluginMessage: message }, '*');
}

/** En dessous de ce mouvement, un pointerdown reste un simple clic de sélection. */
const DRAG_THRESHOLD_PX = 3;

/**
 * Fraction (0–1) d'un slot qu'il reste à parcourir, avant un recouvrement
 * complet avec la vignette voisine, pour que le réordonnancement se
 * déclenche déjà — plutôt que d'attendre d'être quasiment empilé dessus.
 */
const DRAG_SWAP_MARGIN = 0.32;

/** Monogramme "B" — packages/plugin/src/assets/logo.svg (repo billeltighidet). */
function Logo() {
  return (
    <a href="https://billeltighidet.fr" target="_blank" rel="noreferrer" title="billeltighidet.fr">
      <svg className="f2s-logo" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="80" height="80" rx="40" fill="#F06800" />
        <path
          d="M48.6887 47.1716C50.2508 48.7337 50.2508 51.2664 48.6887 52.8285L44.2034 57.3138C41.6836 59.8336 37.375 58.049 37.375 54.4854L37.375 45.5148C37.375 41.9512 41.6836 40.1665 44.2034 42.6864L48.6887 47.1716Z"
          fill="#F2ECE8"
        />
        <path
          d="M48.6887 27.1715C50.2508 28.7335 50.2508 31.2662 48.6887 32.8283L44.2034 37.3136C41.6836 39.8334 37.375 38.0488 37.375 34.4852L37.375 25.5146C37.375 21.951 41.6836 20.1663 44.2034 22.6862L48.6887 27.1715Z"
          fill="#F2ECE8"
        />
        <rect x="30.6235" y="21.0001" width="3" height="37" rx="1.5" fill="#F2ECE8" />
      </svg>
    </a>
  );
}

function App() {
  const [mode, setMode] = useState<AppMode>('deck');
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
  // Drag au pointeur plutôt qu'au HTML5 natif : ce dernier affiche un
  // "ghost" translucide géré par le navigateur (avec son ombre par défaut,
  // pas stylable) qui ne suit pas le curseur en continu — on préfère
  // déplacer la vignette nous-mêmes via un `transform` recalculé à chaque
  // `pointermove`, sans ombre.
  //
  // `order` lui-même ne change PAS pendant le drag (un seul `setOrder` à la
  // fin, au relâchement) : les autres vignettes se décalent d'un cran
  // ENTIER via un simple transform CSS animé (jamais de valeur
  // intermédiaire), calculé à partir de leur index d'origine — ça évite
  // qu'un réordonnancement live du tableau ne fasse aussi bouger le SLOT de
  // la vignette déplacée (ce qui s'additionnerait à son propre suivi du
  // curseur et le ferait dériver).
  const [dragId, setDragId] = useState<string | undefined>();
  const [dragOffsetY, setDragOffsetY] = useState(0);
  // Le retour visuel "grab" ne doit apparaître qu'une fois un vrai
  // déplacement détecté (pas au simple hover ni au clic de sélection) : on
  // n'active `dragActive` qu'après un mouvement de quelques pixels, pour
  // laisser la place à la sélection tant que l'intention de glisser n'est
  // pas claire.
  const [dragActive, setDragActive] = useState(false);
  // Index (dans `order`, figé pendant tout le drag) où la vignette
  // atterrirait si on relâchait maintenant — c'est ce qui pilote le décalage
  // visuel des autres vignettes.
  const [dragTargetIndex, setDragTargetIndex] = useState(0);
  // Au relâchement, `order` se réorganise ET les transforms de drag/ghost
  // repassent à zéro dans le MÊME rendu : la nouvelle position de flux de
  // chaque vignette compense déjà exactement le transform qu'on retire, donc
  // le résultat visuel ne doit pas bouger. Mais comme `transform` reste une
  // propriété transitionnée (transition CSS 180ms), le navigateur anime ce
  // retour à zéro par-dessus une position de flux qui, elle, a déjà sauté
  // instantanément — d'où un survol d'un cran suivi d'un retour. On coupe
  // donc la transition pour cet unique rendu de relâchement, le temps que le
  // saut de position et la remise à zéro du transform s'appliquent ensemble.
  const [suppressShiftTransition, setSuppressShiftTransition] = useState(false);
  const dragStartYRef = useRef(0);
  const dragStartIndexRef = useRef(0);
  // Hauteur d'un "pas" (slot + gap) entre deux vignettes consécutives,
  // mesurée une seule fois au `pointerdown` — sert de base au calcul du pas
  // franchi par targetIndexFromOffset, indépendamment des transforms qu'on
  // applique nous-mêmes en cours de route (qui, eux, ne changent jamais la
  // position de layout, donc fausseraient une mesure live).
  const slotHeightRef = useRef(0);
  const sidebarItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [selecting, setSelecting] = useState(false);
  const [selectionNotice, setSelectionNotice] = useState<string | undefined>();
  const [hasCanvasSelection, setHasCanvasSelection] = useState(false);

  const [sessionToken, setSessionToken] = useState<string | undefined>();
  const [loginError, setLoginError] = useState<string | undefined>();
  const [authUrl, setAuthUrl] = useState<string | undefined>();
  const [backend] = useState<BackendConfig>({ baseUrl: typeof __BACKEND_URL__ === 'string' ? __BACKEND_URL__ : 'https://figma-to-slide-backend.vercel.app' });

  // La copie de vérification (brief export ponctuel) reste manuelle dans
  // Figma pour l'instant : ce qu'on peut déjà offrir ici, c'est le linter
  // visuel sur les frames ajoutées — actif par défaut sur la première frame
  // pour qu'il y ait toujours quelque chose à prévisualiser dès l'ajout.
  useEffect(() => {
    if (!activeId && order.length > 0) setActiveId(order[0]);
  }, [order, activeId]);

  useEffect(() => {
    if (!activeTemplateId && templateOrder.length > 0) setActiveTemplateId(templateOrder[0]);
  }, [templateOrder, activeTemplateId]);

  const activeFrame = activeId ? frames[activeId] : undefined;
  const activeTemplateLayout = activeTemplateId ? templateLayouts[activeTemplateId] : undefined;

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
  const pendingAssets = useMemo(() => new Map<string, ArrayBuffer>(), []);

  // Le handler `onMessage` ci-dessous n'est branché qu'une fois (deps: []) ;
  // sans cette ref, `handleExportPayload` y capturerait à jamais la valeur
  // de `sessionToken` telle qu'elle était au montage (undefined), et
  // l'en-tête Authorization serait alors omis même après avoir collé le
  // jeton — d'où un 401 permanent quel que soit le contenu du champ.
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
            },
          }));
          setOrder((prev) => (prev.includes(f.id) ? prev : [...prev, f.id]));
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
        case 'canvas-selection-changed':
          setHasCanvasSelection(Boolean(msg.hasSelection));
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
            setTemplateSelectionNotice(`${msg.count} layouts selected — beyond ${msg.max}, keep a template focused.`);
          } else {
            setSelectionNotice(`${msg.count} frames selected — beyond ${msg.max}, export may become slow.`);
          }
          break;
        case 'export-payload':
          void handleExportPayload(msg.document as IRDocument);
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

  async function handleExportPayload(doc: IRDocument) {
    setExportState('exporting');
    setExportProgress(0);
    setExportError(undefined);
    try {
      // Les assets arrivent par messages séparés juste après export-payload ;
      // on laisse un court délai pour qu'ils soient tous bufferisés.
      await new Promise((r) => setTimeout(r, 50));
      await uploadAssetBatches([...pendingAssets]);

      const form = new FormData();
      form.append('document', JSON.stringify(doc));

      const res = await fetch(`${backend.baseUrl}/export`, {
        method: 'POST',
        body: form,
        headers: sessionTokenRef.current ? { Authorization: `Bearer ${sessionTokenRef.current}` } : undefined,
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => undefined);
        throw new Error(body?.error ? `${body.error} (${res.status})` : `Export rejected (${res.status})`);
      }
      const { jobId } = await res.json();
      await pollJob(jobId);
    } catch (err) {
      setExportState('error');
      setExportError(err instanceof Error ? err.message : String(err));
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }

  async function pollJob(jobId: string) {
    for (let i = 0; i < 120; i++) {
      const res = await fetch(`${backend.baseUrl}/export/${jobId}`, { credentials: 'include' });
      const job = await res.json();
      const batches = job.batches as { status: string }[] | undefined;
      if (batches && batches.length > 0) {
        const applied = batches.filter((b) => b.status === 'applied').length;
        setExportProgress(Math.round((applied / batches.length) * 100));
      }
      if (job.status === 'done') {
        setExportState('done');
        setExportProgress(100);
        setResultUrl(job.presentationUrl);
        return;
      }
      if (job.status === 'failed') {
        setExportState('error');
        // Priorité aux erreurs par slide (`batch.error`) : bien plus
        // actionnables que le message générique de `job.error`, qui ne
        // couvre que l'échec global (ex. la création de présentation
        // elle-même a échoué, avant même le premier lot).
        const batchErrors = (job.batches as { error?: string }[] | undefined)
          ?.map((b) => b.error)
          .filter((e): e is string => Boolean(e));
        setExportError(
          batchErrors && batchErrors.length > 0 ? batchErrors.join(' · ') : (job.error ?? 'Unknown server-side failure.'),
        );
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setExportState('error');
  }

  /**
   * Sonde `/auth/session/:pollId` jusqu'à ce que le callback OAuth (ouvert
   * dans l'onglet externe par le lien "Connect to Google") ait produit un
   * jeton de session — remplace l'ancien copier-coller manuel : l'utilisateur
   * n'a plus qu'à se connecter dans l'onglet Google puis revenir sur Figma,
   * le plugin détecte la connexion tout seul.
   */
  async function pollAuthSession(pollId: string) {
    for (let i = 0; i < 400; i++) {
      if (sessionTokenRef.current) return;
      try {
        const res = await fetch(`${backend.baseUrl}/auth/session/${pollId}`, { credentials: 'include' });
        const result = (await res.json()) as AuthPollResult;
        if (result.status === 'ready') {
          setSessionToken(sanitizeSessionToken(result.sessionToken));
          setAuthUrl(undefined);
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
    // soit déjà prêt — l'utilisateur n'a alors besoin que d'UN clic dessus,
    // au lieu d'un premier clic pour révéler le lien puis un second pour le
    // suivre.
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
  // `slidesExportReady` à la réouverture du plugin) serait perdu, `postMessage`
  // ne bufferisant rien côté destinataire.
  useEffect(() => {
    postToPlugin({ type: 'ui-ready' });
  }, []);

  function handlePrepareForSlides() {
    // Le choix de police fait dans le select "Fonts:" (par famille d'origine)
    // s'applique désormais directement sur la copie posée sur le canvas —
    // pas seulement à l'export — pour que la copie soit une vraie preview.
    postToPlugin({ type: 'prepare-for-slides', fontOverrides });
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

  function selectFrame(id: string) {
    setActiveId(id);
    postToPlugin({ type: 'select-nodes', nodeIds: [id] });
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

  function selectTemplateLayout(id: string) {
    setActiveTemplateId(id);
    postToPlugin({ type: 'select-nodes', nodeIds: [id] });
  }

  /** Sélectionne dans Figma le(s) nœud(s) source visés par un avertissement ou un placeholder — même geste que le rapport de fidélité du deck (spec §8.3). */
  function selectSourceNodes(sourceNodeIds: string[]) {
    postToPlugin({ type: 'select-nodes', nodeIds: sourceNodeIds });
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

  /**
   * Index (dans l'`order` FIGÉ du début de drag) où la vignette atterrirait,
   * calculé à partir du déplacement du POINTEUR lui-même (`offsetY`, déjà
   * relatif au point de saisie) plutôt que d'une position absolue comparée
   * aux tops d'origine des autres vignettes — cette dernière approche
   * introduisait un biais selon l'endroit où l'utilisateur avait attrapé la
   * vignette, et exigeait de fait un recouvrement quasi complet avec la
   * voisine avant de déclencher le pas suivant. Ici, un pas se déclenche dès
   * que `offsetY` dépasse `slotHeight * (1 - DRAG_SWAP_MARGIN)` : le
   * réordonnancement anticipe donc la pile complète de la marge voulue.
   */
  function targetIndexFromOffset(offsetY: number): number {
    const slotHeight = slotHeightRef.current;
    const lastIndex = order.length - 1;
    if (slotHeight <= 0) return dragStartIndexRef.current;
    const steps = Math.sign(offsetY) * Math.floor(Math.abs(offsetY) / slotHeight + DRAG_SWAP_MARGIN);
    return Math.max(0, Math.min(lastIndex, dragStartIndexRef.current + steps));
  }

  function handleDragPointerDown(e: { clientY: number }, id: string) {
    dragStartYRef.current = e.clientY;
    setDragOffsetY(0);
    setDragActive(false);
    setDragId(id);

    const currentOrder = order;
    const startIndex = currentOrder.indexOf(id);
    dragStartIndexRef.current = startIndex;
    setDragTargetIndex(startIndex);

    const firstTop = sidebarItemRefs.current.get(currentOrder[0])?.getBoundingClientRect().top;
    const secondTop = currentOrder.length > 1 ? sidebarItemRefs.current.get(currentOrder[1])?.getBoundingClientRect().top : undefined;
    slotHeightRef.current =
      firstTop !== undefined && secondTop !== undefined
        ? secondTop - firstTop
        : (sidebarItemRefs.current.get(id)?.getBoundingClientRect().height ?? 0);
  }

  useEffect(() => {
    if (!dragId) return;
    const draggedId = dragId;

    function onPointerMove(e: PointerEvent) {
      const offset = e.clientY - dragStartYRef.current;
      setDragOffsetY(offset);
      const active = Math.abs(offset) > DRAG_THRESHOLD_PX;
      setDragActive((prev) => prev || active);
      // Le décalage des autres vignettes ne doit apparaître qu'une fois
      // l'intention de glisser confirmée (au-delà du seuil) — jamais sur un
      // simple clic de sélection.
      if (active) setDragTargetIndex(targetIndexFromOffset(offset));
    }
    function onPointerUp(e: PointerEvent) {
      const finalIndex = targetIndexFromOffset(e.clientY - dragStartYRef.current);
      // Un seul `setOrder`, au relâchement : au moment où il s'applique, les
      // autres vignettes sont déjà visuellement à leur place finale (décalées
      // via transform ci-dessous) — l'array qui les rattrape à cet instant
      // précis ne produit donc aucun saut visible... à condition que ce
      // rattrapage soit instantané (voir `suppressShiftTransition` ci-dessus).
      setSuppressShiftTransition(true);
      setOrder((prev) => moveToIndex(prev, draggedId, finalIndex));
      setDragId(undefined);
      setDragOffsetY(0);
      setDragActive(false);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId]);

  // Réactive la transition juste après que le rendu "instantané" du
  // relâchement a été peint, pour que le prochain drag retrouve son
  // animation normale.
  useEffect(() => {
    if (!suppressShiftTransition) return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSuppressShiftTransition(false));
    });
    return () => cancelAnimationFrame(frame);
  }, [suppressShiftTransition]);

  function startExport() {
    setExportState('exporting');
    setExportProgress(0);
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
      presentationTitle: 'Export Figma → Slides',
      fontOverrides,
    });
  }

  /**
   * Réutilise le MÊME état d'export (`exportState`/`resultUrl`/…) que le
   * deck : côté backend, un template n'est jamais qu'une présentation dont
   * chaque slide est un layout réutilisable — même pipeline `/assets` +
   * `/export` (voir handleExportPayload plus haut, mode-agnostique).
   */
  function startTemplateCreate() {
    setExportState('exporting');
    setExportProgress(0);
    postToPlugin({
      type: 'request-template',
      includedFrameIds: templateOrder,
      order: templateOrder,
      presentationTitle: 'Figma template',
      fontOverrides,
    });
  }

  const exporting = exportState === 'exporting';

  return (
    <>
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

        <div className="f2s-toolbar-group f2s-topbar-center">
          <span className="f2s-toolbar-label">Dimensions:</span>
          <span className="f2s-dim-box">
            {mode === 'deck' ? (activeFrame ? Math.round(activeFrame.width) : '—') : activeTemplateLayout ? Math.round(activeTemplateLayout.width) : '—'}
          </span>
          <span className="f2s-dim-sep">×</span>
          <span className="f2s-dim-box">
            {mode === 'deck' ? (activeFrame ? Math.round(activeFrame.height) : '—') : activeTemplateLayout ? Math.round(activeTemplateLayout.height) : '—'}
          </span>
        </div>

        {mode === 'deck' ? (
          <div className="f2s-topbar-actions">
            <button
              type="button"
              className="f2s-btn f2s-btn--secondary"
              disabled={!hasCanvasSelection}
              title="Duplicate the selected frame(s) on the Figma canvas, reformatted for Slides, so you can refine them pixel-perfect natively."
              onClick={handlePrepareForSlides}
            >
              Prepare for Slides
            </button>
            <button type="button" className="f2s-btn f2s-btn--tertiary" onClick={handleAddFramesClick}>
              {selecting ? 'Add selection' : 'Select frames to add'}
            </button>
            {sessionToken ? (
              <button type="button" className="f2s-btn f2s-btn--primary" disabled={exporting || order.length === 0} onClick={startExport}>
                Export
              </button>
            ) : authUrl ? (
              // Un vrai <a target="_blank"> cliqué par l'utilisateur : voir le
              // commentaire de startLogin plus haut sur la CSP du plugin Figma.
              <a href={authUrl} target="_blank" rel="noreferrer" className="f2s-btn f2s-btn--primary">
                Export
              </a>
            ) : loginError ? (
              <button type="button" className="f2s-btn f2s-btn--primary" onClick={startLogin}>
                Export
              </button>
            ) : (
              // TODO(TODO.md) : état de chargement pendant qu'on attend le lien
              // Google — pour l'instant juste désactivé, sans feedback visuel.
              <button type="button" className="f2s-btn f2s-btn--primary" disabled>
                Export
              </button>
            )}
            {exportState === 'done' && resultUrl && (
              <a href={resultUrl} target="_blank" rel="noreferrer" className="f2s-btn f2s-btn--secondary">
                Open presentation
              </a>
            )}
          </div>
        ) : (
          <div className="f2s-topbar-actions">
            <button type="button" className="f2s-btn f2s-btn--tertiary" onClick={handleAddTemplateLayoutClick}>
              {templateSelecting ? 'Add selection' : 'Select layout to add'}
            </button>
            {sessionToken ? (
              <button
                type="button"
                className="f2s-btn f2s-btn--primary"
                disabled={exporting || templateOrder.length === 0 || templateHasBlockingLayout}
                title={templateHasBlockingLayout ? 'Fix the blocking issues listed below before creating the template.' : undefined}
                onClick={startTemplateCreate}
              >
                Create template
              </button>
            ) : authUrl ? (
              <a href={authUrl} target="_blank" rel="noreferrer" className="f2s-btn f2s-btn--primary">
                Create template
              </a>
            ) : loginError ? (
              <button type="button" className="f2s-btn f2s-btn--primary" onClick={startLogin}>
                Create template
              </button>
            ) : (
              <button type="button" className="f2s-btn f2s-btn--primary" disabled>
                Create template
              </button>
            )}
            {exportState === 'done' && resultUrl && (
              <a href={resultUrl} target="_blank" rel="noreferrer" className="f2s-btn f2s-btn--secondary">
                Open presentation
              </a>
            )}
          </div>
        )}
      </header>

      <div className="f2s-toolbar">
        <div className="f2s-toolbar-row">
          <div className="f2s-toolbar-group">
            <span className="f2s-toolbar-label">Fonts:</span>
            {(mode === 'deck' ? deckFontSubstitutions : templateFontSubstitutions).length === 0 ? (
              <span className="f2s-toolbar-muted">No substitution</span>
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
      <div className="f2s-body">
        <aside className="f2s-sidebar">
          {selecting && order.length > 0 && !hasCanvasSelection && (
            <p className="f2s-toolbar-muted">Select one or more frames on the Figma canvas, then click "Add selection".</p>
          )}
          {order.length === 0 ? (
            <p className="f2s-empty">
              {selecting
                ? 'Select one or more frames on the Figma canvas, then click "Add selection".'
                : 'Click "Select frames to add" to choose what should be exported.'}
            </p>
          ) : (
            order.map((id, index) => {
              const f = frames[id];
              if (!f) return null;
              const isDragging = dragId === id && dragActive;
              // Décalage "fantôme" des autres vignettes pour ouvrir/refermer
              // la place, d'un cran entier (jamais une fraction) selon que
              // l'index d'origine de CETTE vignette se trouve entre le point
              // de départ et la cible actuelle du drag.
              let ghostShift = 0;
              if (dragId && dragActive && !isDragging) {
                const start = dragStartIndexRef.current;
                if (start < dragTargetIndex && index > start && index <= dragTargetIndex) {
                  ghostShift = -slotHeightRef.current;
                } else if (start > dragTargetIndex && index >= dragTargetIndex && index < start) {
                  ghostShift = slotHeightRef.current;
                }
              }
              return (
                <div
                  key={id}
                  ref={(el) => {
                    if (el) sidebarItemRefs.current.set(id, el);
                    else sidebarItemRefs.current.delete(id);
                  }}
                  className={`f2s-sidebar-item${isDragging ? ' is-dragging' : ''}${suppressShiftTransition ? ' is-releasing' : ''}`}
                  style={
                    isDragging
                      ? { transform: `translateY(${dragOffsetY}px)` }
                      : ghostShift !== 0
                        ? { transform: `translateY(${ghostShift}px)` }
                        : undefined
                  }
                >
                  <button
                    type="button"
                    className={`f2s-frame-preview${activeId === id ? ' is-active' : ''}`}
                    onClick={() => selectFrame(id)}
                    onPointerDown={(e) => handleDragPointerDown(e, id)}
                  >
                    {f.previewDataUrl && <img src={f.previewDataUrl} alt={f.name} draggable={false} />}
                  </button>
                  <div className="f2s-frame-info">
                    <span className="f2s-frame-text">{index + 1}</span>
                    <div className="f2s-frame-controls">
                      <button type="button" className="f2s-icon-btn" title="Remove" onClick={() => removeFrame(id)}>
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </aside>

        <main className="f2s-canvas">
          {activeFrame ? (
            <div className="f2s-canvas-preview">
              {activeFrame.previewDataUrl && <img src={activeFrame.previewDataUrl} alt={activeFrame.name} />}
            </div>
          ) : (
            <p className="f2s-canvas-empty">Select a frame on the left to preview it.</p>
          )}
        </main>
      </div>
      ) : (
      <div className="f2s-body">
        <aside className="f2s-sidebar">
          {templateSelectionNotice && <p className="f2s-error">{templateSelectionNotice}</p>}
          {templateSelecting && templateOrder.length > 0 && !hasCanvasSelection && (
            <p className="f2s-toolbar-muted">Select one or more frames on the Figma canvas, then click "Add selection".</p>
          )}
          {templateOrder.length === 0 ? (
            <p className="f2s-empty">
              {templateSelecting
                ? 'Select one or more frames on the Figma canvas, then click "Add selection".'
                : 'Click "Select layout to add" to choose the layouts that make up this template — e.g. a title slide, a content slide.'}
            </p>
          ) : (
            templateOrder.map((id, index) => {
              const layout = templateLayouts[id];
              if (!layout) return null;
              return (
                <div key={id} className="f2s-sidebar-item">
                  <button
                    type="button"
                    className={`f2s-frame-preview${activeTemplateId === id ? ' is-active' : ''}${layout.blocking ? ' f2s-frame-preview--blocking' : ''}`}
                    onClick={() => selectTemplateLayout(id)}
                    title={layout.blocking ? 'Contains an element that would be rasterized — open it to see the details.' : undefined}
                  >
                    {layout.previewDataUrl && <img src={layout.previewDataUrl} alt={layout.name} draggable={false} />}
                  </button>
                  <div className="f2s-frame-info">
                    <span className="f2s-frame-text">
                      {index + 1}. {layout.name}
                    </span>
                    <div className="f2s-frame-controls">
                      <button type="button" className="f2s-icon-btn" title="Remove" onClick={() => removeTemplateLayout(id)}>
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </aside>

        <main className="f2s-canvas f2s-canvas--template">
          {activeTemplateLayout ? (
            <div className="f2s-tmpl-report">
              <div className="f2s-canvas-preview f2s-tmpl-preview">
                {activeTemplateLayout.previewDataUrl && <img src={activeTemplateLayout.previewDataUrl} alt={activeTemplateLayout.name} />}
              </div>

              <div className="f2s-tmpl-panel">
                {activeTemplateLayout.warnings.filter((w) => w.severity === 'blocking').length > 0 && (
                  <section className="f2s-tmpl-section f2s-tmpl-section--blocking">
                    <h3 className="f2s-tmpl-heading">Fix before creating the template</h3>
                    <ul className="f2s-tmpl-list">
                      {activeTemplateLayout.warnings
                        .filter((w) => w.severity === 'blocking')
                        .map((w, i) => (
                          <li key={i}>
                            <button type="button" className="f2s-tmpl-warning" onClick={() => selectSourceNodes([w.sourceNodeId])}>
                              <strong>{w.nodeName}</strong> — {w.message}
                            </button>
                          </li>
                        ))}
                    </ul>
                  </section>
                )}

                <section className="f2s-tmpl-section">
                  <h3 className="f2s-tmpl-heading">Placeholders</h3>
                  {activeTemplateLayout.placeholders.length === 0 ? (
                    <p className="f2s-toolbar-muted">
                      No tagged placeholder yet — prefix a layer name in Figma with <code>[[title]]</code>, <code>[[body]]</code>,{' '}
                      <code>[[image]]</code>, <code>[[subtitle]]</code> or <code>[[logo]]</code> to mark it.
                    </p>
                  ) : (
                    <ul className="f2s-tmpl-list">
                      {activeTemplateLayout.placeholders.map((p) => (
                        <li key={p.id}>
                          <button type="button" className="f2s-tmpl-chip" onClick={() => selectSourceNodes([p.sourceNodeId])}>
                            <span className={`f2s-tmpl-role f2s-tmpl-role--${p.role.toLowerCase()}`}>{p.role}</span>
                            {p.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="f2s-tmpl-section">
                  <h3 className="f2s-tmpl-heading">Colors</h3>
                  {activeTemplateLayout.colors.length === 0 ? (
                    <p className="f2s-toolbar-muted">No solid color detected.</p>
                  ) : (
                    <div className="f2s-tmpl-swatches">
                      {activeTemplateLayout.colors.map((c, i) => (
                        <span
                          key={i}
                          className="f2s-tmpl-swatch"
                          style={{ backgroundColor: c.hex, opacity: c.alpha }}
                          title={`${c.hex} · used ${c.usageCount}×`}
                        />
                      ))}
                    </div>
                  )}
                </section>

                <section className="f2s-tmpl-section">
                  <h3 className="f2s-tmpl-heading">Typography</h3>
                  {activeTemplateLayout.fonts.length === 0 ? (
                    <p className="f2s-toolbar-muted">No text detected.</p>
                  ) : (
                    <ul className="f2s-tmpl-list">
                      {activeTemplateLayout.fonts.map((f) => (
                        <li key={f.family}>
                          <span className="f2s-tmpl-font-family">{f.family}</span>{' '}
                          <span className="f2s-toolbar-muted">({f.weights.join(', ')})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          ) : (
            <p className="f2s-canvas-empty">Select a layout on the left to see its report.</p>
          )}
        </main>
      </div>
      )}

      {/*
        Désactivé pour l'instant (cf TODO.md) : le bouton Export du header
        gère désormais la connexion Google lui-même, et ce pied de page sera
        repensé plus tard (indicateur de progression/erreur + rappel "Buy
        Me a Coffee") plutôt que remis tel quel.

      showStatusBar && (
        <footer className="f2s-statusbar">
          {!sessionToken && (
            <div className="f2s-login">
              {authUrl ? (
                <>
                  <a href={authUrl} target="_blank" rel="noreferrer" className="f2s-btn f2s-btn--secondary">
                    Connect to Google
                  </a>
                  <span className="f2s-toolbar-muted">Waiting for you to finish signing in…</span>
                </>
              ) : loginError ? (
                <button type="button" className="f2s-btn f2s-btn--secondary" onClick={startLogin}>
                  Retry
                </button>
              ) : (
                <button type="button" className="f2s-btn f2s-btn--secondary" disabled>
                  Preparing link…
                </button>
              )}
            </div>
          )}
          {loginError && (
            <p className="f2s-error">
              Connection failed: {loginError}. Make sure the backend is running on {backend.baseUrl} and that{' '}
              <code>PLUGIN_ALLOWED_ORIGINS</code> allows this plugin's origin.
            </p>
          )}
          {selectionNotice && <p className="f2s-error">{selectionNotice}</p>}
          {exporting && (
            <div className="f2s-progress">
              <span className="f2s-spinner" />
              Exporting… {exportProgress}%
            </div>
          )}
          {exportState === 'done' && resultUrl && (
            <div className="f2s-progress">
              ✅ Done — <a href={resultUrl} target="_blank" rel="noreferrer">open presentation</a>
            </div>
          )}
          {exportState === 'error' && <div className="f2s-error">Export failed: {exportError ?? 'unknown error.'}</div>}
        </footer>
      )
      */}
    </>
  );
}

render(<App />, document.getElementById('app')!);
