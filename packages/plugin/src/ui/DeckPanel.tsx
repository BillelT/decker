import { useEffect } from 'preact/hooks';
import { logEntryFlag, logEntryTagText, logEntryTooltip } from './logEntryFlag.js';
import { usePacedExportCursor } from './pacedExportCursor.js';
import { RetroExportPreview } from './RetroExportPreview.js';
import { Toast } from './StatusIcon.js';
import { useRailReorder } from './useRailReorder.js';
import type { ExportCursor } from './exportCursor.js';
import { selectSourceNodes, type FrameState, type Notice } from './types.js';

export interface DeckPanelProps {
  order: string[];
  setOrder: (updater: (prev: string[]) => string[]) => void;
  frames: Record<string, FrameState>;
  activeId: string | undefined;
  setActiveId: (id: string) => void;
  onRemove: (id: string) => void;
  /** Choix manuel de police (bandeau "Fonts") — reflété dans le tag des entrées FONT_SUBSTITUTED, voir logEntryFlag.ts. */
  fontOverrides: Record<string, string>;
  /** Frame dont le lot est en cours d'application côté backend, s'il y a un export en cours. */
  exportCursor?: ExportCursor;
  /** Incrémenté à chaque lancement d'export/retry — voir usePacedExportCursor. */
  exportAttempt?: number;
  /** Le job d'export en cours (celui qui a produit `exportCursor`) est-il conclu (réussi ou échoué) ? */
  exportConcluded: boolean;
  /**
   * Notice de sélection ("no-frames-selected" / "too-many-frames") pilotée
   * par ui.tsx, auto-dismiss inclus. Affichée en toast absolu (voir `.f2s-toast`)
   * plutôt qu'en texte inline dans le rail : ce dernier a une largeur fixe de
   * 190px, un message un peu long y casserait la mise en page des vignettes.
   */
  notice: Notice | undefined;
  /** Ferme le toast (croix, ou fin de sa durée d'affichage). */
  onDismissNotice: () => void;
  /**
   * Un export tourne : le rail est figé (ni retrait, ni réordonnancement).
   * Les deux modifient `order`, la liste même que l'aperçu d'export parcourt
   * (usePacedExportCursor) : retirer une frame en plein export décalait la
   * progression affichée sur la mauvaise slide.
   */
  locked: boolean;
  /** Slides en échec du dernier export (id → message du lot), voir ui.tsx. */
  failedSlides: Record<string, string> | undefined;
  /** L'export est conclu ET l'aperçu a fini de défiler : le succès peut s'annoncer (voir ui.tsx). */
  onPreviewSettled: () => void;
  /** Slide affichée par l'aperçu d'export, à chaque pas : le bouton principal en tire « Exporting 2/4 » (voir ui.tsx). */
  onPacedCursorChange: (cursor: ExportCursor | undefined) => void;
}

/**
 * Rail de vignettes réordonnables + grand aperçu du mode deck. Le drag au
 * pointeur (plutôt qu'au HTML5 natif) et toute sa mécanique vivent ici :
 * voir les commentaires de chaque état — l'essentiel est que `order` ne
 * change qu'UNE fois, au relâchement, pendant que les autres vignettes se
 * décalent d'un cran entier via un transform CSS animé.
 */
export function DeckPanel({
  order,
  setOrder,
  frames,
  activeId,
  setActiveId,
  onRemove,
  fontOverrides,
  exportCursor,
  exportAttempt,
  exportConcluded,
  notice,
  onDismissNotice,
  locked,
  failedSlides,
  onPreviewSettled,
  onPacedCursorChange,
}: DeckPanelProps) {
  const { itemRefs, itemState, registerItem, onThumbPointerDown, onThumbKeyDown, announcement } = useRailReorder(order, setOrder, locked);

  const activeFrame = activeId ? frames[activeId] : undefined;
  // Aperçu d'export "paced" : avance d'une frame à la fois plutôt que de
  // suivre tel quel `exportCursor` (qui peut sauter plusieurs slides, ou
  // disparaître avant la fin de la révélation de la dernière — voir
  // pacedExportCursor.ts).
  const pacedCursor = usePacedExportCursor(exportAttempt, order, exportCursor, exportConcluded);
  const pacedIndex = pacedCursor?.index;
  const pacedTotal = pacedCursor?.total;
  useEffect(() => {
    onPacedCursorChange(pacedCursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacedIndex, pacedTotal]);
  // Pendant un export, l'aperçu suit la frame en cours de traitement plutôt
  // que la sélection du rail : c'est elle que l'utilisateur regarde
  // "s'imprimer". Dimensions et logs suivent le même repère pour ne pas
  // décrire une autre frame que celle affichée.
  const exportingFrame = pacedCursor ? frames[pacedCursor.frameId] : undefined;
  const previewedFrame = exportingFrame ?? activeFrame;
  // Le rail suit le même repère que le grand aperçu : pendant un export, la
  // vignette "active" (bordure pleine) est celle en cours de traitement, pas
  // la sélection d'avant l'export — sans quoi les deux surlignages (actif +
  // pulsation d'export) pointent sur deux vignettes différentes.
  const highlightedId = pacedCursor?.frameId ?? activeId;
  const previewedFailure = previewedFrame ? failedSlides?.[previewedFrame.id] : undefined;

  // Job conclu ET séquence d'aperçu terminée : ui.tsx peut annoncer le
  // succès sans contredire un aperçu encore en train de "générer".
  const previewSettled = exportConcluded && !pacedCursor;
  useEffect(() => {
    if (previewSettled) onPreviewSettled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewSettled]);

  // Fin d'un export en échec partiel : l'aperçu saute sur la première slide
  // en échec (dans l'ordre du rail), pour que la raison s'affiche sans avoir
  // à chercher quelle vignette porte le badge.
  const firstFailedId = failedSlides ? order.find((id) => id in failedSlides) : undefined;
  useEffect(() => {
    if (firstFailedId) setActiveId(firstFailedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstFailedId]);

  // Fait défiler le rail jusqu'à la vignette surlignée dès qu'elle change —
  // utile en cours d'export sur un deck plus long que la hauteur visible du
  // rail, où sinon la vignette en cours de traitement peut être hors champ.
  useEffect(() => {
    if (!highlightedId) return;
    itemRefs.current.get(highlightedId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightedId]);

  /**
   * Cliquer une vignette du rail ne fait QUE changer l'aperçu affiché dans
   * le plugin — ça reste une simple navigation entre slides, pas une
   * demande explicite de retrouver le calque dans Figma (contrairement à un
   * clic sur une ligne du rapport de contenu, cf. `selectSourceNodes` /
   * spec §8.3) : select-nodes ferait sauter le canvas Figma à chaque clic,
   * ce qui est perturbant en pratique.
   */
  function selectFrame(id: string) {
    setActiveId(id);
  }

  if (order.length === 0) {
    return (
      <div className="f2s-body">
        {notice && <Toast key={notice.id} notice={notice} onDismiss={onDismissNotice} />}
        <main className="f2s-canvas">
          {/* État vide qui oriente : les trois étapes du parcours, avec le nom
              exact des boutons qui les déclenchent. */}
          <ol className="f2s-empty-steps">
            <li>Select frames on the Figma canvas.</li>
            <li>
              <span>
                Click <strong>Add</strong>: they join the deck in the order you selected them.
              </span>
            </li>
            <li>
              <span>
                Click <strong>Export</strong> to create the presentation in Google Slides.
              </span>
            </li>
          </ol>
        </main>
      </div>
    );
  }

  return (
    <div className="f2s-body">
      {notice && <Toast key={notice.id} notice={notice} onDismiss={onDismissNotice} />}
      {/* Région d'annonce stable, montée avant tout export : un lecteur
          d'écran y entend l'avancée de l'export ("Generating slide 2 of 4",
          muette jusque-là) et les déplacements de vignette au clavier. */}
      <p className="f2s-sr-only" role="status">
        {pacedCursor ? `Generating slide ${pacedCursor.index + 1} of ${pacedCursor.total}` : announcement}
      </p>
      <aside className="f2s-sidebar">
        {order.map((id, index) => {
          const failure = failedSlides?.[id];
          const f = frames[id];
          if (!f) return null;
          const item = itemState(id, index);
          return (
            <div key={id} ref={registerItem(id)} className={item.className} style={item.style}>
              <button
                type="button"
                className={`f2s-frame-preview${highlightedId === id ? ' is-active' : ''}${failure ? ' f2s-frame-preview--failed' : ''}${pacedCursor?.frameId === id ? ' is-exporting' : ''}`}
                onClick={() => selectFrame(id)}
                onPointerDown={(e) => onThumbPointerDown(e, id)}
                onKeyDown={(e) => onThumbKeyDown(e, id)}
                aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                title={failure ? `Export failed: ${failure}` : undefined}
              >
                {f.previewDataUrl && <img src={f.previewDataUrl} alt={f.name} draggable={false} />}
              </button>
              <div className="f2s-frame-info">
                <span className="f2s-frame-text">{index + 1}</span>
                <div className="f2s-frame-controls">
                  <button
                    type="button"
                    className="f2s-icon-btn"
                    disabled={locked}
                    title={locked ? 'An export is running. Wait for it to finish before changing the list.' : `Remove slide ${index + 1}`}
                    aria-label={`Remove slide ${index + 1}`}
                    onClick={() => onRemove(id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </aside>

      <main className="f2s-canvas">
        {previewedFrame ? (
          <>
            {previewedFailure && !exportingFrame && (
              <div className="f2s-logs f2s-tmpl-section--blocking f2s-export-failure" role="alert">
                <div className="f2s-logs-header">
                  <h3 className="f2s-tmpl-heading">This slide failed to export</h3>
                </div>
                <p className="f2s-export-failure-message">{previewedFailure}</p>
              </div>
            )}

            {exportingFrame && pacedCursor ? (
              <div className="f2s-canvas-preview f2s-canvas-preview--retro">
                <RetroExportPreview
                  src={exportingFrame.previewDataUrl}
                  frameName={exportingFrame.name}
                  index={pacedCursor.index}
                  total={pacedCursor.total}
                />
              </div>
            ) : (
              <div className="f2s-canvas-preview">
                {previewedFrame.previewDataUrl && <img src={previewedFrame.previewDataUrl} alt={previewedFrame.name} />}
              </div>
            )}

            <div className="f2s-toolbar-group">
              <span className="f2s-toolbar-label">Dimensions :</span>
              <span className="f2s-dim-box">{Math.round(previewedFrame.width)}</span>
              <span className="f2s-dim-sep">×</span>
              <span className="f2s-dim-box">{Math.round(previewedFrame.height)}</span>
              <span className="f2s-dim-unit">px</span>
            </div>

            <div className="f2s-logs">
              <div className="f2s-logs-header">
                <h3 className="f2s-tmpl-heading">Content</h3>
                {previewedFrame.nativeCount !== undefined && previewedFrame.rasterCount !== undefined && (
                  <span className="f2s-toolbar-muted f2s-tabular">
                    {previewedFrame.nativeCount} native · {previewedFrame.rasterCount} rasterized
                  </span>
                )}
              </div>
              {previewedFrame.warnings && previewedFrame.warnings.length > 0 ? (
                <ul className="f2s-tmpl-list">
                  {/* Les éléments rasterisés (perte d'édition native) passent en
                      tête de liste — le repère le plus important, celui qu'on
                      veut voir sans avoir à parcourir toute la liste. Tri stable :
                      l'ordre relatif au sein de chaque groupe ne bouge pas. */}
                  {[...previewedFrame.warnings]
                    .sort((a, b) => (logEntryFlag(a.code) === 'rasterized' ? 0 : 1) - (logEntryFlag(b.code) === 'rasterized' ? 0 : 1))
                    .map((w, i) => {
                    const flag = logEntryFlag(w.code);
                    const tagText = flag ? logEntryTagText(w, fontOverrides) : undefined;
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          className={`f2s-log-entry${w.severity === 'blocking' ? ' f2s-log-entry--blocking' : ''}${flag ? ` f2s-log-entry--${flag}` : ''}`}
                          title={`${w.nodeName}: ${logEntryTooltip(w, tagText)}`}
                          onClick={() => selectSourceNodes([w.sourceNodeId])}
                        >
                          {/* Le nom du calque (nodeName) vient de Figma, où le nom par défaut d'un
                              calque texte est son contenu entier : sur un long paragraphe, ça
                              déborde. Tronqué en priorité sur une ligne, à gauche — le tag (la
                              raison) reste entier à droite, le libellé complet reste dans `title`.
                              Le message n'est affiché que si l'entrée n'a pas de tag (ex.
                              placeholder inconnu) : sinon la raison est déjà dans le tag. */}
                          <span className="f2s-log-entry-text">
                            <strong className="f2s-log-entry-name">{w.nodeName}</strong>
                            {!tagText && <span className="f2s-log-entry-message">: {w.message}</span>}
                          </span>
                          {tagText && <span className={`f2s-log-entry-flag f2s-log-entry-flag--${flag}`}>{tagText}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="f2s-toolbar-muted">No issues detected on this frame.</p>
              )}
            </div>
          </>
        ) : (
          <p className="f2s-canvas-empty">Select a frame on the left to preview it.</p>
        )}
      </main>
    </div>
  );
}
