import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ExportOptions, IRDocument, IRWarning } from '@figma-to-slides/shared';

interface FrameCandidate {
  id: string;
  name: string;
  width: number;
  height: number;
}

interface FrameState extends FrameCandidate {
  previewDataUrl?: string;
  included: boolean;
  nativeCount?: number;
  rasterCount?: number;
  warnings?: IRWarning[];
}

type BackendConfig = { baseUrl: string };

// Injecté au build (voir esbuild.config.mjs) ou saisi manuellement par
// l'utilisateur au premier lancement — stocké via figma.clientStorage
// (spec §7.2, réutilisé ici pour la config backend).
declare const __BACKEND_URL__: string;

function postToPlugin(message: Record<string, unknown>): void {
  parent.postMessage({ pluginMessage: message }, '*');
}

function App() {
  const [frames, setFrames] = useState<Record<string, FrameState>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [sessionToken, setSessionToken] = useState<string | undefined>();
  const [loginError, setLoginError] = useState<string | undefined>();
  const [backend] = useState<BackendConfig>({ baseUrl: typeof __BACKEND_URL__ === 'string' ? __BACKEND_URL__ : 'http://localhost:8787' });
  const [exportState, setExportState] = useState<'idle' | 'analyzing' | 'exporting' | 'done' | 'error'>('idle');
  const [resultUrl, setResultUrl] = useState<string | undefined>();
  const pendingAssets = useMemo(() => new Map<string, ArrayBuffer>(), []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'candidates': {
          const next: Record<string, FrameState> = {};
          const nextOrder: string[] = [];
          for (const f of msg.frames as FrameCandidate[]) {
            next[f.id] = { ...f, included: true };
            nextOrder.push(f.id);
          }
          setFrames(next);
          setOrder(nextOrder);
          break;
        }
        case 'preview':
          setFrames((prev) => ({ ...prev, [msg.frameId]: { ...prev[msg.frameId], previewDataUrl: msg.previewDataUrl } }));
          break;
        case 'analysis':
          setFrames((prev) => ({
            ...prev,
            [msg.frameId]: { ...prev[msg.frameId], nativeCount: msg.nativeCount, rasterCount: msg.rasterCount, warnings: msg.warnings },
          }));
          break;
        case 'export-payload':
          void handleExportPayload(msg.document as IRDocument);
          break;
        case 'export-asset':
          pendingAssets.set(msg.assetKey, msg.bytes);
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExportPayload(doc: IRDocument) {
    setExportState('exporting');
    try {
      const form = new FormData();
      form.append('document', JSON.stringify(doc));
      // Les assets arrivent par messages séparés juste après export-payload ;
      // on laisse un court délai pour qu'ils soient tous bufferisés.
      await new Promise((r) => setTimeout(r, 50));
      for (const [assetKey, buf] of pendingAssets) {
        form.append(assetKey, new Blob([buf], { type: 'image/png' }), assetKey);
      }

      const res = await fetch(`${backend.baseUrl}/export`, {
        method: 'POST',
        body: form,
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Export refusé (${res.status})`);
      const { jobId } = await res.json();
      await pollJob(jobId);
    } catch (err) {
      setExportState('error');
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }

  async function pollJob(jobId: string) {
    for (let i = 0; i < 120; i++) {
      const res = await fetch(`${backend.baseUrl}/export/${jobId}`, { credentials: 'include' });
      const job = await res.json();
      if (job.status === 'done') {
        setExportState('done');
        setResultUrl(job.presentationUrl);
        return;
      }
      if (job.status === 'failed') {
        setExportState('error');
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setExportState('error');
  }

  function startLogin() {
    setLoginError(undefined);
    // Le navigateur n'autorise window.open() que dans le prolongement
    // synchrone d'un geste utilisateur : on ouvre l'onglet TOUT DE SUITE
    // (vide) puis on le redirige une fois l'authUrl récupérée. Faire le
    // fetch avant l'open (comme avant) casse cette chaîne et le navigateur
    // bloque la popup sans la moindre erreur visible.
    const popup = window.open('about:blank', '_blank');
    fetch(`${backend.baseUrl}/auth/google`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => undefined);
          throw new Error(body?.message ?? `Le backend a répondu ${res.status}`);
        }
        return res.json();
      })
      .then(({ authUrl }) => {
        if (popup) {
          popup.location.href = authUrl;
        } else {
          // La popup elle-même a été bloquée (bloqueur de pub, réglages
          // navigateur…) : on retombe sur une navigation dans l'onglet
          // courant plutôt que de rester bloqué silencieusement.
          window.location.href = authUrl;
        }
      })
      .catch((err) => {
        popup?.close();
        setLoginError(err instanceof Error ? err.message : String(err));
        // eslint-disable-next-line no-console
        console.error('[figma-to-slides] startLogin failed', err);
      });
  }

  function toggleFrame(id: string) {
    setFrames((prev) => ({ ...prev, [id]: { ...prev[id], included: !prev[id].included } }));
  }

  function startExport() {
    setExportState('analyzing');
    const options: ExportOptions = {
      mode: 'new-presentation',
      rasterScale: 2,
      includeUnderlay: false,
      underlayOpacity: 0.3,
      strictMode: false,
    };
    postToPlugin({
      type: 'request-export',
      includedFrameIds: order.filter((id) => frames[id]?.included),
      order,
      options,
      presentationTitle: 'Export Figma → Slides',
    });
  }

  const totalNative = order.reduce((sum, id) => sum + (frames[id]?.nativeCount ?? 0), 0);
  const totalRaster = order.reduce((sum, id) => sum + (frames[id]?.rasterCount ?? 0), 0);
  const totalObjects = totalNative + totalRaster;

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, padding: 12 }}>
      <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Figma → Google Slides</h2>

      {!sessionToken && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={startLogin}>Se connecter à Google</button>
          {loginError && (
            <p style={{ color: '#FF6B6B' }}>
              ❌ Échec de la connexion : {loginError}. Vérifie que le backend tourne bien sur {backend.baseUrl} et
              que <code>PLUGIN_ALLOWED_ORIGINS</code> autorise l'origine de ce plugin.
            </p>
          )}
          <p style={{ opacity: 0.7 }}>
            Après consentement, colle le jeton de session renvoyé par le backend :
          </p>
          <input
            placeholder="jeton de session"
            onChange={(e) => setSessionToken((e.target as HTMLInputElement).value)}
            style={{ width: '100%' }}
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {order.map((id) => {
          const f = frames[id];
          if (!f) return null;
          return (
            <div key={id} style={{ border: '1px solid #444', borderRadius: 4, padding: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={f.included} onChange={() => toggleFrame(id)} />
                <strong>{f.name}</strong>
              </label>
              {f.previewDataUrl && <img src={f.previewDataUrl} style={{ width: '100%', display: 'block', marginTop: 4 }} />}
              <div style={{ fontSize: 10, opacity: 0.8 }}>
                {f.width}×{f.height}px
                {f.nativeCount !== undefined && (
                  <> · {f.nativeCount} natifs / {f.rasterCount} rasterisés</>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Spec §8.3 — rapport de fidélité pré-export. */}
      {totalObjects > 0 && (
        <div style={{ marginTop: 12, border: '1px solid #444', borderRadius: 4, padding: 8 }}>
          <div>
            {order.length} frames · {totalObjects} objets
          </div>
          <div>✓ {totalNative} objets natifs éditables ({((totalNative / totalObjects) * 100).toFixed(0)}%)</div>
          <div>▣ {totalRaster} objets convertis en image ({((totalRaster / totalObjects) * 100).toFixed(0)}%)</div>
          {order.flatMap((id) => frames[id]?.warnings ?? []).map((w, i) => (
            <div
              key={i}
              style={{ cursor: 'pointer', opacity: 0.85 }}
              onClick={() => postToPlugin({ type: 'select-nodes', nodeIds: [w.sourceNodeId] })}
            >
              ⚠ {w.message} — <em>{w.nodeName}</em>
            </div>
          ))}
        </div>
      )}

      <button style={{ marginTop: 12 }} disabled={exportState === 'exporting' || exportState === 'analyzing'} onClick={startExport}>
        Exporter vers Google Slides
      </button>

      {exportState === 'done' && resultUrl && (
        <p>
          ✅ Terminé — <a href={resultUrl} target="_blank" rel="noreferrer">ouvrir la présentation</a>
        </p>
      )}
      {exportState === 'error' && <p style={{ color: '#FF6B6B' }}>❌ L'export a échoué. Voir la console pour le détail.</p>}
    </div>
  );
}

render(<App />, document.getElementById('app')!);
