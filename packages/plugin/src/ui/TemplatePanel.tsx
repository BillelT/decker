import { useEffect, useRef, useState } from 'preact/hooks';
import { moveToIndex } from './reorderFrames.js';
import { RetroExportPreview } from './RetroExportPreview.js';
import type { ExportCursor } from './exportCursor.js';
import { postToPlugin, selectSourceNodes, type TemplateLayoutState } from './types.js';

/** En dessous de ce mouvement, un pointerdown reste un simple clic de sélection. */
const DRAG_THRESHOLD_PX = 3;

/**
 * Fraction (0–1) d'un slot qu'il reste à parcourir, avant un recouvrement
 * complet avec la vignette voisine, pour que le réordonnancement se
 * déclenche déjà — plutôt que d'attendre d'être quasiment empilé dessus.
 */
const DRAG_SWAP_MARGIN = 0.32;

export interface TemplatePanelProps {
  order: string[];
  setOrder: (updater: (prev: string[]) => string[]) => void;
  layouts: Record<string, TemplateLayoutState>;
  activeId: string | undefined;
  setActiveId: (id: string) => void;
  selecting: boolean;
  hasCanvasSelection: boolean;
  notice: string | undefined;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  /** Layout dont le lot est en cours d'application côté backend, s'il y a une création de template en cours. */
  exportCursor?: ExportCursor;
}

/**
 * Rail de layouts (réordonnable par drag, même mécanique que DeckPanel) +
 * rapport de contenu communicable du mode template
 * (brief-creation-template-google-slides.md : couleurs, typos, layouts,
 * placeholders).
 */
export function TemplatePanel({
  order,
  setOrder,
  layouts,
  activeId,
  setActiveId,
  selecting,
  hasCanvasSelection,
  notice,
  onRemove,
  onRename,
  exportCursor,
}: TemplatePanelProps) {
  const [dragId, setDragId] = useState<string | undefined>();
  const [dragOffsetY, setDragOffsetY] = useState(0);
  // Le retour visuel "grab" ne doit apparaître qu'une fois un vrai
  // déplacement détecté (pas au simple hover ni au clic de sélection).
  const [dragActive, setDragActive] = useState(false);
  // Index (dans `order`, figé pendant tout le drag) où la vignette
  // atterrirait si on relâchait maintenant — pilote le décalage visuel des
  // autres vignettes.
  const [dragTargetIndex, setDragTargetIndex] = useState(0);
  // Au relâchement, `order` se réorganise ET les transforms repassent à zéro
  // dans le MÊME rendu ; la transition CSS animerait ce retour à zéro
  // par-dessus une position de flux qui a déjà sauté — on coupe donc la
  // transition pour cet unique rendu de relâchement.
  const [suppressShiftTransition, setSuppressShiftTransition] = useState(false);
  const dragStartYRef = useRef(0);
  const dragStartIndexRef = useRef(0);
  // Hauteur d'un "pas" (slot + gap), mesurée une seule fois au pointerdown.
  const slotHeightRef = useRef(0);
  const sidebarItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const activeLayout = activeId ? layouts[activeId] : undefined;
  // Pendant une création de template, l'aperçu suit le layout dont le lot
  // est en cours d'application plutôt que la sélection du rail — même
  // logique que DeckPanel.
  const exportingLayout = exportCursor ? layouts[exportCursor.frameId] : undefined;
  const previewedLayout = exportingLayout ?? activeLayout;
  const highlightedId = exportCursor?.frameId ?? activeId;

  // Fait défiler le rail jusqu'à la vignette surlignée dès qu'elle change —
  // utile pendant une création de template plus longue que la hauteur
  // visible du rail.
  useEffect(() => {
    if (!highlightedId) return;
    sidebarItemRefs.current.get(highlightedId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightedId]);

  function selectLayout(id: string) {
    setActiveId(id);
    postToPlugin({ type: 'select-nodes', nodeIds: [id] });
  }

  /**
   * Index (dans l'`order` FIGÉ du début de drag) où la vignette atterrirait,
   * calculé à partir du déplacement du POINTEUR (`offsetY`, relatif au point
   * de saisie) : un pas se déclenche dès que `offsetY` dépasse
   * `slotHeight * (1 - DRAG_SWAP_MARGIN)`.
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
      if (active) setDragTargetIndex(targetIndexFromOffset(offset));
    }
    function onPointerUp(e: PointerEvent) {
      const finalIndex = targetIndexFromOffset(e.clientY - dragStartYRef.current);
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
  // relâchement a été peint.
  useEffect(() => {
    if (!suppressShiftTransition) return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSuppressShiftTransition(false));
    });
    return () => cancelAnimationFrame(frame);
  }, [suppressShiftTransition]);

  if (order.length === 0) {
    return (
      <div className="f2s-body">
        <main className="f2s-canvas">
          <p className="f2s-empty">
            Click "Select layout to add" to choose the layouts that make up this template — e.g. a title slide, a content slide.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="f2s-body">
      <aside className="f2s-sidebar">
        {notice && <p className="f2s-error">{notice}</p>}
        {selecting && !hasCanvasSelection && (
          <p className="f2s-toolbar-muted">Select one or more frames on the Figma canvas, then click "Add selection".</p>
        )}
        {order.map((id, index) => {
          const layout = layouts[id];
          if (!layout) return null;
          const isDragging = dragId === id && dragActive;
          // Décalage "fantôme" des autres vignettes pour ouvrir/refermer la
          // place, d'un cran entier, selon que l'index d'origine de CETTE
          // vignette se trouve entre le départ et la cible du drag.
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
                className={`f2s-frame-preview${highlightedId === id ? ' is-active' : ''}${layout.blocking ? ' f2s-frame-preview--blocking' : ''}${exportCursor?.frameId === id ? ' is-exporting' : ''}`}
                onClick={() => selectLayout(id)}
                onPointerDown={(e) => handleDragPointerDown(e, id)}
                title={layout.blocking ? 'Contains an element that would be rasterized — open it to see the details.' : undefined}
              >
                {layout.previewDataUrl && <img src={layout.previewDataUrl} alt={layout.name} draggable={false} />}
              </button>
              <div className="f2s-frame-info">
                <span className="f2s-frame-index">{index + 1}.</span>
                <input
                  type="text"
                  className="f2s-frame-name-input"
                  value={layout.name}
                  title={layout.name}
                  aria-label="Layout name"
                  onInput={(e) => onRename(id, (e.target as HTMLInputElement).value)}
                />
                <div className="f2s-frame-controls">
                  <button type="button" className="f2s-icon-btn" title="Remove" onClick={() => onRemove(id)}>
                    ✕
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </aside>

      <main className="f2s-canvas f2s-canvas--template">
        {previewedLayout ? (
          <div className="f2s-tmpl-report">
            {exportingLayout && exportCursor ? (
              <div className="f2s-tmpl-preview">
                <RetroExportPreview
                  key={exportCursor.frameId}
                  src={exportingLayout.previewDataUrl}
                  frameName={exportingLayout.name}
                  index={exportCursor.index}
                  total={exportCursor.total}
                />
              </div>
            ) : (
              <div className="f2s-canvas-preview f2s-tmpl-preview">
                {previewedLayout.previewDataUrl && <img src={previewedLayout.previewDataUrl} alt={previewedLayout.name} />}
              </div>
            )}

            <div className="f2s-tmpl-panel">
              {previewedLayout.warnings.filter((w) => w.severity === 'blocking').length > 0 && (
                <section className="f2s-tmpl-section f2s-tmpl-section--blocking">
                  <h3 className="f2s-tmpl-heading">Fix before creating the template</h3>
                  <ul className="f2s-tmpl-list">
                    {previewedLayout.warnings
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

              {previewedLayout.warnings.filter((w) => w.severity !== 'blocking').length > 0 && (
                <section className="f2s-tmpl-section">
                  <h3 className="f2s-tmpl-heading">Notes</h3>
                  <ul className="f2s-tmpl-list">
                    {previewedLayout.warnings
                      .filter((w) => w.severity !== 'blocking')
                      .map((w, i) => (
                        <li key={i}>
                          <button type="button" className="f2s-tmpl-note-item" onClick={() => selectSourceNodes([w.sourceNodeId])}>
                            <strong>{w.nodeName}</strong> — {w.message}
                          </button>
                        </li>
                      ))}
                  </ul>
                </section>
              )}

              <section className="f2s-tmpl-section">
                <h3 className="f2s-tmpl-heading">Placeholders</h3>
                {previewedLayout.placeholders.length === 0 ? (
                  <p className="f2s-toolbar-muted">
                    No tagged placeholder yet — prefix a layer name in Figma with <code>[[title]]</code>, <code>[[body]]</code>,{' '}
                    <code>[[image]]</code>, <code>[[subtitle]]</code> or <code>[[logo]]</code> to mark it.
                  </p>
                ) : (
                  <ul className="f2s-tmpl-list">
                    {previewedLayout.placeholders.map((p) => (
                      <li key={p.id}>
                        <button type="button" className="f2s-tmpl-chip" onClick={() => selectSourceNodes([p.sourceNodeId])}>
                          <span className="f2s-tmpl-role">{p.role}</span>
                          {p.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="f2s-tmpl-section">
                <h3 className="f2s-tmpl-heading">Colors</h3>
                {previewedLayout.colors.length === 0 ? (
                  <p className="f2s-toolbar-muted">No solid color detected.</p>
                ) : (
                  <ul className="f2s-tmpl-swatches">
                    {previewedLayout.colors.map((c, i) => (
                      <li key={i} className="f2s-tmpl-swatch-item">
                        {/* Fond damier sous la pastille : une couleur semi-transparente
                            se lit comme telle au lieu d'être faussée par le fond du panneau. */}
                        <span className="f2s-tmpl-swatch">
                          <span
                            className="f2s-tmpl-swatch-color"
                            style={{ backgroundColor: c.hex, opacity: c.alpha }}
                          />
                        </span>
                        <span className="f2s-tmpl-swatch-label">
                          {c.hex}
                          {c.alpha < 1 ? ` · ${Math.round(c.alpha * 100)}%` : ''}
                          <span className="f2s-toolbar-muted"> · used {c.usageCount}×</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="f2s-tmpl-section">
                <h3 className="f2s-tmpl-heading">Typography</h3>
                {previewedLayout.fonts.length === 0 ? (
                  <p className="f2s-toolbar-muted">No text detected.</p>
                ) : (
                  <ul className="f2s-tmpl-list">
                    {previewedLayout.fonts.map((f) => (
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
  );
}
