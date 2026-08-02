import { useEffect, useRef, useState } from 'preact/hooks';
import { moveToIndex } from './reorderFrames.js';
import { RetroExportPreview } from './RetroExportPreview.js';
import type { ExportCursor } from './exportCursor.js';
import { postToPlugin, selectSourceNodes, type FrameState } from './types.js';

/** En dessous de ce mouvement, un pointerdown reste un simple clic de sélection. */
const DRAG_THRESHOLD_PX = 3;

/**
 * Repère à mettre en avant dans les Logs : un calque rasterisé quitte
 * l'édition native (police, interligne, espacement des lettres figés en
 * pixels au moment de l'export) ; un calque gardé natif mais listé ici
 * (police substituée, radius approximé) peut malgré tout rendre différemment
 * de l'original faute d'équivalent exact côté Slides. Les deux catégories
 * méritent de sauter aux yeux plutôt que de se fondre avec le reste des
 * entrées (ex. tag de placeholder inconnu, qui est un souci de config, pas
 * de fidélité visuelle).
 */
const RASTERIZED_WARNING_CODES = new Set([
  'FONT_MISSING',
  'GRADIENT_RASTERIZED',
  'EFFECT_RASTERIZED',
  'BLEND_MODE_RASTERIZED',
  'MASK_RASTERIZED',
  'VECTOR_RASTERIZED',
  'LINE_RASTERIZED',
  'LETTER_SPACING_LOST',
  'CORNER_RADIUS_RASTERIZED',
  'MULTIPLE_FILLS_RASTERIZED',
]);

const VISUAL_DIFF_WARNING_CODES = new Set(['FONT_SUBSTITUTED', 'RADIUS_APPROXIMATED']);

function logEntryFlag(code: string): 'rasterized' | 'visual-diff' | undefined {
  if (RASTERIZED_WARNING_CODES.has(code)) return 'rasterized';
  if (VISUAL_DIFF_WARNING_CODES.has(code)) return 'visual-diff';
  return undefined;
}

/**
 * Fraction (0–1) d'un slot qu'il reste à parcourir, avant un recouvrement
 * complet avec la vignette voisine, pour que le réordonnancement se
 * déclenche déjà — plutôt que d'attendre d'être quasiment empilé dessus.
 */
const DRAG_SWAP_MARGIN = 0.32;

export interface DeckPanelProps {
  order: string[];
  setOrder: (updater: (prev: string[]) => string[]) => void;
  frames: Record<string, FrameState>;
  activeId: string | undefined;
  setActiveId: (id: string) => void;
  selecting: boolean;
  hasCanvasSelection: boolean;
  onRemove: (id: string) => void;
  /** Frame dont le lot est en cours d'application côté backend, s'il y a un export en cours. */
  exportCursor?: ExportCursor;
  /**
   * Notice de sélection ("no-frames-selected" / "too-many-frames") pilotée
   * par ui.tsx, auto-dismiss inclus. Affichée en toast absolu (voir `.f2s-toast`)
   * plutôt qu'en texte inline dans le rail : ce dernier a une largeur fixe de
   * 190px, un message un peu long y casserait la mise en page des vignettes.
   */
  notice: string | undefined;
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
  selecting,
  hasCanvasSelection,
  onRemove,
  exportCursor,
  notice,
}: DeckPanelProps) {
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

  const activeFrame = activeId ? frames[activeId] : undefined;
  // Pendant un export, l'aperçu suit la frame en cours de traitement plutôt
  // que la sélection du rail : c'est elle que l'utilisateur regarde
  // "s'imprimer". Dimensions et logs suivent le même repère pour ne pas
  // décrire une autre frame que celle affichée.
  const exportingFrame = exportCursor ? frames[exportCursor.frameId] : undefined;
  const previewedFrame = exportingFrame ?? activeFrame;
  // Le rail suit le même repère que le grand aperçu : pendant un export, la
  // vignette "active" (bordure pleine) est celle en cours de traitement, pas
  // la sélection d'avant l'export — sans quoi les deux surlignages (actif +
  // pulsation d'export) pointent sur deux vignettes différentes.
  const highlightedId = exportCursor?.frameId ?? activeId;

  // Fait défiler le rail jusqu'à la vignette surlignée dès qu'elle change —
  // utile en cours d'export sur un deck plus long que la hauteur visible du
  // rail, où sinon la vignette en cours de traitement peut être hors champ.
  useEffect(() => {
    if (!highlightedId) return;
    sidebarItemRefs.current.get(highlightedId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightedId]);

  function selectFrame(id: string) {
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
        {notice && (
          <div className="f2s-toast" role="status">
            {notice}
          </div>
        )}
        <main className="f2s-canvas">
          <p className="f2s-empty">
            Use "Select frames to add", then select the frames
            <br />
            you want to export on the Figma canvas, and click the button again to add your selection.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="f2s-body">
      {notice && (
        <div className="f2s-toast" role="status">
          {notice}
        </div>
      )}
      <aside className="f2s-sidebar">
        {selecting && !hasCanvasSelection && (
          <p className="f2s-toolbar-muted">Select one or more frames on the Figma canvas, then click "Add selection".</p>
        )}
        {order.map((id, index) => {
          const f = frames[id];
          if (!f) return null;
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
                className={`f2s-frame-preview${highlightedId === id ? ' is-active' : ''}${exportCursor?.frameId === id ? ' is-exporting' : ''}`}
                onClick={() => selectFrame(id)}
                onPointerDown={(e) => handleDragPointerDown(e, id)}
              >
                {f.previewDataUrl && <img src={f.previewDataUrl} alt={f.name} draggable={false} />}
              </button>
              <div className="f2s-frame-info">
                <span className="f2s-frame-text">{index + 1}</span>
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

      <main className="f2s-canvas">
        {previewedFrame ? (
          <>
            {exportingFrame && exportCursor ? (
              <RetroExportPreview
                key={exportCursor.frameId}
                src={exportingFrame.previewDataUrl}
                frameName={exportingFrame.name}
                index={exportCursor.index}
                total={exportCursor.total}
              />
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
                <h3 className="f2s-tmpl-heading">Logs</h3>
                {previewedFrame.nativeCount !== undefined && previewedFrame.rasterCount !== undefined && (
                  <span className="f2s-toolbar-muted">
                    {previewedFrame.nativeCount} native · {previewedFrame.rasterCount} rasterized
                  </span>
                )}
              </div>
              {previewedFrame.warnings && previewedFrame.warnings.length > 0 ? (
                <ul className="f2s-tmpl-list">
                  {previewedFrame.warnings.map((w, i) => {
                    const flag = logEntryFlag(w.code);
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          className={`f2s-log-entry${w.severity === 'blocking' ? ' f2s-log-entry--blocking' : ''}${flag ? ` f2s-log-entry--${flag}` : ''}`}
                          title={`${w.nodeName} — ${w.message}`}
                          onClick={() => selectSourceNodes([w.sourceNodeId])}
                        >
                          {flag && (
                            <span className={`f2s-log-entry-flag f2s-log-entry-flag--${flag}`}>
                              {flag === 'rasterized' ? 'Rasterized' : 'May look different'}
                            </span>
                          )}
                          {/* Le nom du calque (nodeName) vient de Figma, où le nom par défaut d'un
                              calque texte est son contenu entier : sur un long paragraphe, ça
                              déborde. Tronqué en priorité sur une ligne — le message (ce qui a
                              été fait) reste lisible, le libellé complet reste dans `title`. */}
                          <span className="f2s-log-entry-text">
                            <strong className="f2s-log-entry-name">{w.nodeName}</strong>
                            <span className="f2s-log-entry-message">— {w.message}</span>
                          </span>
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
