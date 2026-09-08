import { useEffect, useRef, useState } from 'preact/hooks';
import { logEntryFlag, logEntryTagText, logEntryTooltip } from './logEntryFlag.js';
import { placeholderRoleTagsFor } from './placeholderRoleOptions.js';
import { moveToIndex } from './reorderFrames.js';
import { usePacedExportCursor } from './pacedExportCursor.js';
import { RetroExportPreview } from './RetroExportPreview.js';
import { TemplateStylePanel, type TemplateStylePanelProps } from './TemplateStylePanel.js';
import type { ExportCursor } from './exportCursor.js';
import { postToPlugin, selectSourceNodes, type TemplateLayoutState, type TemplateWarning } from './types.js';
import { CANONICAL_TAG_FOR_ROLE, parsePlaceholderTag } from '../serialize/placeholder.js';

function setPlaceholderRole(sourceNodeId: string, tag: string): void {
  postToPlugin({ type: 'set-placeholder-role', sourceNodeId, tag });
}

/**
 * Rendu d'une liste de warnings (bloquants ou non) au même aspect que le
 * panneau Content du mode deck (DeckPanel.tsx) — même structure de bouton,
 * même troncature sur une ligne pour le nom de calque, tag à droite.
 *
 * `roleSelectable` n'ajoute le sélecteur de rôle de placeholder qu'à la
 * liste "Content" (pas à "Fix before creating the template" juste
 * au-dessus) : assigner un rôle à un calque encore bloquant n'a pas de sens
 * tant que le blocage lui-même n'est pas réglé.
 */
function TemplateLogList({
  warnings,
  fontOverrides,
  roleSelectable,
}: {
  warnings: TemplateWarning[];
  fontOverrides: Record<string, string>;
  roleSelectable?: boolean;
}) {
  return (
    <ul className="f2s-tmpl-list">
      {warnings.map((w, i) => {
        const flag = logEntryFlag(w.code);
        const tagText = flag ? logEntryTagText(w, fontOverrides) : undefined;
        const currentRole = parsePlaceholderTag(w.nodeName)?.role;
        return (
          <li key={i} className={`f2s-log-entry${w.severity === 'blocking' ? ' f2s-log-entry--blocking' : ''}${flag ? ` f2s-log-entry--${flag}` : ''}`}>
            <button type="button" className="f2s-log-entry-clickarea" title={`${w.nodeName}: ${logEntryTooltip(w, tagText)}`} onClick={() => selectSourceNodes([w.sourceNodeId])}>
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
            {roleSelectable && (
              <select
                className="f2s-log-entry-role"
                value={currentRole ? CANONICAL_TAG_FOR_ROLE[currentRole] : ''}
                title="Assign this content to a Slides template placeholder role"
                onChange={(e) => setPlaceholderRole(w.sourceNodeId, (e.target as HTMLSelectElement).value)}
              >
                <option value="" disabled>
                  Set placeholder role…
                </option>
                {placeholderRoleTagsFor(w.code).map((tag) => (
                  <option key={tag} value={tag}>
                    [[{tag}]]
                  </option>
                ))}
              </select>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** En dessous de ce mouvement, un pointerdown reste un simple clic de sélection. */
const DRAG_THRESHOLD_PX = 3;

/**
 * Fraction (0–1) d'un slot qu'il reste à parcourir, avant un recouvrement
 * complet avec la vignette voisine, pour que le réordonnancement se
 * déclenche déjà — plutôt que d'attendre d'être quasiment empilé dessus.
 */
const DRAG_SWAP_MARGIN = 0.32;

export interface TemplatePanelProps extends TemplateStylePanelProps {
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
  /** Incrémenté à chaque lancement d'export/retry — voir usePacedExportCursor. */
  exportAttempt?: number;
  /** Le job en cours (celui qui a produit `exportCursor`) est-il conclu (réussi ou échoué) ? */
  exportConcluded: boolean;
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
  fontOverrides,
  exportCursor,
  exportAttempt,
  exportConcluded,
  colors,
  fonts,
  colorRoles,
  setColorRoles,
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
  // Aperçu d'export "paced" — voir DeckPanel et pacedExportCursor.ts.
  const pacedCursor = usePacedExportCursor(exportAttempt, order, exportCursor, exportConcluded);
  // Pendant une création de template, l'aperçu suit le layout dont le lot
  // est en cours d'application plutôt que la sélection du rail — même
  // logique que DeckPanel.
  const exportingLayout = pacedCursor ? layouts[pacedCursor.frameId] : undefined;
  const previewedLayout = exportingLayout ?? activeLayout;
  const highlightedId = pacedCursor?.frameId ?? activeId;

  // Fait défiler le rail jusqu'à la vignette surlignée dès qu'elle change —
  // utile pendant une création de template plus longue que la hauteur
  // visible du rail.
  useEffect(() => {
    if (!highlightedId) return;
    sidebarItemRefs.current.get(highlightedId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightedId]);

  /** Voir le commentaire équivalent dans DeckPanel.selectFrame : un clic de
   *  navigation dans le rail ne doit pas faire sauter le canvas Figma. */
  function selectLayout(id: string) {
    setActiveId(id);
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
            Click "Select layout to add", then select the frames
            <br />
            you want to use as a layout on the Figma canvas, and click the button again to add your selection.
          </p>
        </main>
        <aside className="f2s-style-aside">
          <TemplateStylePanel
            colors={colors}
            fonts={fonts}
            fontOverrides={fontOverrides}
            colorRoles={colorRoles}
            setColorRoles={setColorRoles}
          />
        </aside>
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
                className={`f2s-frame-preview${highlightedId === id ? ' is-active' : ''}${layout.blocking ? ' f2s-frame-preview--blocking' : ''}${pacedCursor?.frameId === id ? ' is-exporting' : ''}`}
                onClick={() => selectLayout(id)}
                onPointerDown={(e) => handleDragPointerDown(e, id)}
                title={layout.blocking ? 'Contains an element that would be rasterized. Open it to see the details.' : undefined}
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
            {exportingLayout && pacedCursor ? (
              <div className="f2s-canvas-preview f2s-canvas-preview--retro f2s-tmpl-preview">
                <RetroExportPreview
                  src={exportingLayout.previewDataUrl}
                  frameName={exportingLayout.name}
                  index={pacedCursor.index}
                  total={pacedCursor.total}
                />
              </div>
            ) : (
              <div className="f2s-canvas-preview f2s-tmpl-preview">
                {previewedLayout.previewDataUrl && <img src={previewedLayout.previewDataUrl} alt={previewedLayout.name} />}
              </div>
            )}

            <div className="f2s-tmpl-panel">
              <section className="f2s-tmpl-section">
                <h3 className="f2s-tmpl-heading">Placeholders</h3>
                {previewedLayout.placeholders.length === 0 ? (
                  <p className="f2s-toolbar-muted">
                    No tagged placeholder yet. Prefix a layer name in Figma with <code>[[title]]</code>, <code>[[body]]</code>,{' '}
                    <code>[[image]]</code>, <code>[[subtitle]]</code> or <code>[[logo]]</code> to mark it.
                  </p>
                ) : (
                  <ul className="f2s-tmpl-list">
                    {previewedLayout.placeholders.map((p) => (
                      <li key={p.id}>
                        <button type="button" className="f2s-tmpl-chip" title={p.label} onClick={() => selectSourceNodes([p.sourceNodeId])}>
                          <span className="f2s-tmpl-role">{p.role}</span>
                          <span className="f2s-tmpl-chip-label">{p.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {previewedLayout.warnings.filter((w) => w.severity === 'blocking').length > 0 && (
                <div className="f2s-logs f2s-tmpl-section--blocking">
                  <div className="f2s-logs-header">
                    <h3 className="f2s-tmpl-heading">Fix before creating the template</h3>
                  </div>
                  <TemplateLogList warnings={previewedLayout.warnings.filter((w) => w.severity === 'blocking')} fontOverrides={fontOverrides} />
                </div>
              )}

              {previewedLayout.warnings.filter((w) => w.severity !== 'blocking').length > 0 && (
                <div className="f2s-logs">
                  <div className="f2s-logs-header">
                    <h3 className="f2s-tmpl-heading">Content</h3>
                  </div>
                  <TemplateLogList warnings={previewedLayout.warnings.filter((w) => w.severity !== 'blocking')} fontOverrides={fontOverrides} roleSelectable />
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="f2s-canvas-empty">Select a layout on the left to see its report.</p>
        )}
      </main>
      <aside className="f2s-style-aside">
        <TemplateStylePanel
          colors={colors}
          fonts={fonts}
          fontOverrides={fontOverrides}
          colorRoles={colorRoles}
          setColorRoles={setColorRoles}
        />
      </aside>
    </div>
  );
}
