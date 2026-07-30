import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ExportOptions, IRDocument } from '@figma-to-slides/shared';
import { sanitizeSessionToken } from './ui/sanitizeSessionToken.js';
import { reorderFrames, moveToIndex } from './ui/reorderFrames.js';
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

// Injecté au build (voir esbuild.config.mjs) ou saisi manuellement par
// l'utilisateur au premier lancement — stocké via figma.clientStorage
// (spec §7.2, réutilisé ici pour la config backend).
declare const __BACKEND_URL__: string;

function postToPlugin(message: Record<string, unknown>): void {
  parent.postMessage({ pluginMessage: message }, '*');
}

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
  const [frames, setFrames] = useState<Record<string, FrameState>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();
  // Drag au pointeur plutôt qu'au HTML5 natif : ce dernier affiche un
  // "ghost" translucide géré par le navigateur (avec son ombre par défaut,
  // pas stylable) qui ne suit pas le curseur en continu — on préfère
  // déplacer la vignette nous-mêmes via un `transform` recalculé à chaque
  // `pointermove`, sans ombre.
  const [dragId, setDragId] = useState<string | undefined>();
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const dragStartYRef = useRef(0);
  const sidebarItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [selecting, setSelecting] = useState(false);
  const [selectionNotice, setSelectionNotice] = useState<string | undefined>();

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

  const activeFrame = activeId ? frames[activeId] : undefined;

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
        case 'no-frames-selected':
          setSelectionNotice('Select at least one frame on the Figma canvas before clicking.');
          break;
        case 'too-many-frames':
          setSelectionNotice(`${msg.count} frames selected — beyond ${msg.max}, export may become slow.`);
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

  function moveFrame(id: string, direction: -1 | 1) {
    setOrder((prev) => reorderFrames(prev, id, direction));
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

  /**
   * Index où `draggedId` doit atterrir : le nombre d'autres vignettes dont
   * le centre vertical est déjà au-dessus du pointeur. En excluant la
   * vignette déplacée du calcul, cet index reste valable quelle que soit sa
   * position de départ dans `order` (voir `moveToIndex`, qui retire puis
   * réinsère au même index dans le reste de la liste).
   */
  function targetIndexFromPointer(pointerY: number, draggedId: string): number {
    let index = 0;
    for (const id of order) {
      if (id === draggedId) continue;
      const el = sidebarItemRefs.current.get(id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (pointerY > rect.top + rect.height / 2) index++;
    }
    return index;
  }

  function handleDragPointerDown(e: { clientY: number }, id: string) {
    dragStartYRef.current = e.clientY;
    setDragOffsetY(0);
    setDragId(id);
  }

  useEffect(() => {
    if (!dragId) return;
    const draggedId = dragId;

    function onPointerMove(e: PointerEvent) {
      setDragOffsetY(e.clientY - dragStartYRef.current);
    }
    function onPointerUp(e: PointerEvent) {
      const targetIndex = targetIndexFromPointer(e.clientY, draggedId);
      setOrder((prev) => moveToIndex(prev, draggedId, targetIndex));
      setDragId(undefined);
      setDragOffsetY(0);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId]);

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

  const exporting = exportState === 'exporting';
  const showStatusBar = exporting || exportState === 'done' || exportState === 'error' || selectionNotice || loginError || !sessionToken;

  return (
    <>
      <header className="f2s-topbar">
        <Logo />
        <div className="f2s-topbar-actions">
          <button
            type="button"
            className="f2s-btn f2s-btn--secondary"
            disabled
            title="Reusable template creation — separate brief, coming soon."
          >
            Create a template
          </button>
          <button type="button" className="f2s-btn f2s-btn--tertiary" onClick={handleAddFramesClick}>
            {selecting ? 'Add selection' : 'Select frames to add'}
          </button>
          <button
            type="button"
            className="f2s-btn f2s-btn--primary"
            disabled={exporting || order.length === 0 || !sessionToken}
            onClick={startExport}
          >
            Export
          </button>
        </div>
      </header>

      <div className="f2s-toolbar">
        <div className="f2s-toolbar-row f2s-toolbar-row--center">
          <div className="f2s-toolbar-group">
            <span className="f2s-toolbar-label">Dimensions:</span>
            <span className="f2s-dim-box">{activeFrame ? Math.round(activeFrame.width) : '—'}</span>
            <span className="f2s-dim-sep">×</span>
            <span className="f2s-dim-box">{activeFrame ? Math.round(activeFrame.height) : '—'}</span>
          </div>
        </div>
        <div className="f2s-toolbar-row f2s-toolbar-row--start">
          <div className="f2s-toolbar-group">
            <span className="f2s-toolbar-label">Fonts:</span>
            {deckFontSubstitutions.length === 0 ? (
              <span className="f2s-toolbar-muted">No substitution</span>
            ) : (
              deckFontSubstitutions.map((s) => (
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

      <div className="f2s-body">
        <aside className="f2s-sidebar">
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
              const isDragging = dragId === id;
              return (
                <div
                  key={id}
                  ref={(el) => {
                    if (el) sidebarItemRefs.current.set(id, el);
                    else sidebarItemRefs.current.delete(id);
                  }}
                  className={`f2s-sidebar-item${isDragging ? ' is-dragging' : ''}`}
                  style={isDragging ? { transform: `translateY(${dragOffsetY}px)` } : undefined}
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
                      <button type="button" className="f2s-icon-btn" disabled={index === order.length - 1} title="Move down" onClick={() => moveFrame(id, 1)}>
                        ▼
                      </button>
                      <button type="button" className="f2s-icon-btn" disabled={index === 0} title="Move up" onClick={() => moveFrame(id, -1)}>
                        ▲
                      </button>
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

      {showStatusBar && (
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
      )}
    </>
  );
}

render(<App />, document.getElementById('app')!);
