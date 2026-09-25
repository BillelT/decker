import { useEffect, useRef, useState } from 'preact/hooks';
import { logEntryFlag, logEntryTagText, logEntryTooltip } from './logEntryFlag.js';
import { placeholderRoleTagsForKind } from './placeholderRoleOptions.js';
import { moveToIndex } from './reorderFrames.js';
import { usePacedExportCursor } from './pacedExportCursor.js';
import { RetroExportPreview } from './RetroExportPreview.js';
import { TemplateStylePanel, type TemplateStylePanelProps } from './TemplateStylePanel.js';
import type { ExportCursor } from './exportCursor.js';
import { postToPlugin, selectSourceNodes, type TemplateElement, type TemplateLayoutState, type TemplateWarning } from './types.js';
import { CANONICAL_TAG_FOR_ROLE } from '../serialize/placeholder.js';
import { COMPOSITION_WARNING_CODES } from '../serialize/templateComposition.js';
import type { PlaceholderRole } from '@figma-to-slides/shared';

/** `tag` vide = option "No role" : le sandbox retire le tag du calque au lieu d'en poser un. */
function setPlaceholderRole(sourceNodeId: string, tag: string): void {
  postToPlugin({ type: 'set-placeholder-role', sourceNodeId, tag });
}

/**
 * Liste "Content" : TOUS les calques taguables du layout, avec leur rôle
 * de placeholder courant et le sélecteur pour le changer ou le retirer.
 *
 * Remplace l'ancienne paire "Placeholders" (chips, en lecture seule) +
 * sélecteur greffé sur les entrées d'avertissement : un layout sans aucun
 * défaut de fidélité ne produisant aucun avertissement, il n'offrait alors
 * AUCUN moyen d'assigner un rôle depuis le plugin, alors que c'est
 * précisément le layout le plus abouti (TODO.md § Mode template, point 9).
 *
 * `noteByNode` : la note de fidélité (police substituée, radius approximé…)
 * du calque, quand une existe, affichée en tag juste à côté du sélecteur de
 * rôle plutôt que dans une liste "Notes" séparée qui répétait alors les
 * mêmes calques (retour utilisateur). Construit par le parent, qui n'y met
 * que les notes AVEC tag court (police/radius) : un message générique sans
 * tag (ex. "Unknown placeholder tag") ne tiendrait pas sur cette ligne et
 * reste dans "Notes", qui ne liste donc plus que ce que "Content" ne peut
 * pas porter.
 */
function TemplateElementList({ elements, noteByNode }: { elements: TemplateElement[]; noteByNode: Map<string, { flag: 'rasterized' | 'visual-diff'; text: string; tooltip: string }> }) {
  return (
    <ul className="f2s-tmpl-list">
      {elements.map((el) => {
        const role = el.role as PlaceholderRole | undefined;
        const note = noteByNode.get(el.sourceNodeId);
        return (
          <li key={el.id} className={`f2s-log-entry${role ? ' f2s-log-entry--tagged' : ''}`}>
            <button
              type="button"
              className="f2s-log-entry-clickarea"
              title={note ? note.tooltip : el.label ? `${el.name} (${el.label})` : el.name}
              onClick={() => selectSourceNodes([el.sourceNodeId])}
            >
              <span className="f2s-log-entry-text">
                <strong className="f2s-log-entry-name">{el.name}</strong>
              </span>
              {role && <span className="f2s-tmpl-role">{role}</span>}
              {note && <span className={`f2s-log-entry-flag f2s-log-entry-flag--${note.flag}`}>{note.text}</span>}
            </button>
            <select
              className="f2s-log-entry-role"
              value={role ? CANONICAL_TAG_FOR_ROLE[role] : ''}
              title="Assign this layer to a Slides template placeholder role"
              onChange={(e) => setPlaceholderRole(el.sourceNodeId, (e.target as HTMLSelectElement).value)}
            >
              <option value="">No role</option>
              {placeholderRoleTagsForKind(el.kind).map((tag) => (
                <option key={tag} value={tag}>
                  [[{tag}]]
                </option>
              ))}
            </select>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Rendu d'une liste de warnings (bloquants ou non) au même aspect que le
 * panneau Logs du mode deck (DeckPanel.tsx) : même structure de bouton,
 * même troncature sur une ligne pour le nom de calque, tag à droite.
 *
 * Purement informatif : l'assignation d'un rôle de placeholder vit
 * désormais dans la liste "Content" (`TemplateElementList`), qui couvre
 * TOUS les calques et pas seulement ceux qui ont un avertissement.
 *
 * `wrap` passe la ligne en deux temps (nom, puis message sur plusieurs
 * lignes) au lieu de tronquer les deux sur une seule. Réservé à la section
 * Composition : ses messages disent quoi FAIRE ("deux calques tagués
 * [[title]], gardez-en un"), les lire est tout l'intérêt de l'entrée, alors
 * qu'un message de fidélité se résume déjà à son tag de deux mots.
 */
function TemplateLogList({ warnings, fontOverrides, wrap }: { warnings: TemplateWarning[]; fontOverrides: Record<string, string>; wrap?: boolean }) {
  return (
    <ul className="f2s-tmpl-list">
      {warnings.map((w, i) => {
        const flag = logEntryFlag(w.code);
        const tagText = flag ? logEntryTagText(w, fontOverrides) : undefined;
        return (
          <li key={i} className={`f2s-log-entry${wrap ? ' f2s-log-entry--wrap' : ''}${w.severity === 'blocking' ? ' f2s-log-entry--blocking' : ''}${flag ? ` f2s-log-entry--${flag}` : ''}`}>
            <button type="button" className="f2s-log-entry-clickarea" title={`${w.nodeName}: ${logEntryTooltip(w, tagText)}`} onClick={() => selectSourceNodes([w.sourceNodeId])}>
              {/* Le nom du calque (nodeName) vient de Figma, où le nom par défaut d'un
                  calque texte est son contenu entier : sur un long paragraphe, ça
                  déborde. Tronqué en priorité sur une ligne, à gauche — le tag (la
                  raison) reste entier à droite, le libellé complet reste dans `title`.
                  Le message n'est affiché que si l'entrée n'a pas de tag (ex.
                  placeholder inconnu) : sinon la raison est déjà dans le tag. */}
              <span className="f2s-log-entry-text">
                <strong className="f2s-log-entry-name">{w.nodeName}</strong>
                {!tagText && <span className="f2s-log-entry-message">{wrap ? w.message : `: ${w.message}`}</span>}
              </span>
              {tagText && <span className={`f2s-log-entry-flag f2s-log-entry-flag--${flag}`}>{tagText}</span>}
            </button>
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
  /**
   * Validation du renommage (blur ou Entrée, pas à chaque frappe) : renomme
   * la vraie frame Figma. Séparé de `onRename`, qui ne tient que l'état de
   * la saisie : renommer le nœud à chaque caractère déclencherait autant de
   * `nodechange`, donc autant de re-sérialisations du layout.
   */
  onRenameCommit: (id: string, name: string) => void;
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
  onRenameCommit,
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

  // Trois familles distinctes dans le même tableau `warnings` : ce qui
  // BLOQUE la création (fidélité durcie, cf. templateValidation.ts), ce qui
  // relève de la COMPOSITION du layout (templateComposition.ts) et le reste,
  // purement informatif sur le rendu.
  const blockingWarnings = previewedLayout?.warnings.filter((w) => w.severity === 'blocking') ?? [];
  const compositionWarnings = previewedLayout?.warnings.filter((w) => w.severity !== 'blocking' && COMPOSITION_WARNING_CODES.has(w.code)) ?? [];
  const fidelityNotes = previewedLayout?.warnings.filter((w) => w.severity !== 'blocking' && !COMPOSITION_WARNING_CODES.has(w.code)) ?? [];

  // Une note de fidélité sur un calque déjà listé dans "Content" (le cas
  // courant : police substituée/radius approximé, sur un calque taguable)
  // s'affiche désormais en tag à côté de son sélecteur de rôle plutôt que
  // répétée plus bas dans "Notes" (retour utilisateur : les deux listes
  // montraient les mêmes calques). Seules les notes AVEC tag court sont
  // absorbées : un message générique sans tag n'a pas sa place sur cette
  // ligne. "Notes" ne garde donc que ce qui reste : messages sans tag, et
  // notes sur un calque hors "Content" (ex. faute de frappe de tag détectée
  // sur un calque non taguable), jamais perdues, juste pas dupliquées.
  const contentNodeIds = new Set(previewedLayout?.elements.map((el) => el.sourceNodeId) ?? []);
  const noteByNode = new Map<string, { flag: 'rasterized' | 'visual-diff'; text: string; tooltip: string }>();
  const consumedNotes = new Set<TemplateWarning>();
  for (const w of fidelityNotes) {
    if (!contentNodeIds.has(w.sourceNodeId) || noteByNode.has(w.sourceNodeId)) continue;
    const flag = logEntryFlag(w.code);
    if (!flag) continue;
    const text = logEntryTagText(w, fontOverrides);
    noteByNode.set(w.sourceNodeId, { flag, text, tooltip: logEntryTooltip(w, text) });
    consumedNotes.add(w);
  }
  const leftoverNotes = fidelityNotes.filter((w) => !consumedNotes.has(w));

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
                  onChange={(e) => onRenameCommit(id, (e.target as HTMLInputElement).value)}
                  onBlur={(e) => onRenameCommit(id, (e.target as HTMLInputElement).value)}
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
              {blockingWarnings.length > 0 && (
                <div className="f2s-logs f2s-tmpl-section--blocking">
                  <div className="f2s-logs-header">
                    <h3 className="f2s-tmpl-heading">Fix before creating the template</h3>
                  </div>
                  <TemplateLogList warnings={blockingWarnings} fontOverrides={fontOverrides} />
                </div>
              )}

              <section className="f2s-tmpl-section">
                <h3 className="f2s-tmpl-heading">Content</h3>
                {previewedLayout.elements.length === 0 ? (
                  <p className="f2s-toolbar-muted">
                    Nothing to tag in this layout yet. A placeholder can also be set by prefixing a layer name in Figma with <code>[[title]]</code>,{' '}
                    <code>[[body]]</code>, <code>[[image]]</code>, <code>[[subtitle]]</code> or <code>[[logo]]</code>.
                  </p>
                ) : (
                  <TemplateElementList elements={previewedLayout.elements} noteByNode={noteByNode} />
                )}
              </section>

              {/* Composition (TODO.md § Mode template, point 7) : ni un défaut de
                  fidélité, ni un blocage, mais une intention douteuse qui retombera sur
                  tous les futurs utilisateurs du template. Gardée à part des "Notes"
                  de fidélité, qui, elles, ne parlent que du rendu. */}
              {compositionWarnings.length > 0 && (
                <div className="f2s-logs">
                  <div className="f2s-logs-header">
                    <h3 className="f2s-tmpl-heading">Composition</h3>
                  </div>
                  <TemplateLogList warnings={compositionWarnings} fontOverrides={fontOverrides} wrap />
                </div>
              )}

              {leftoverNotes.length > 0 && (
                <div className="f2s-logs">
                  <div className="f2s-logs-header">
                    <h3 className="f2s-tmpl-heading">Notes</h3>
                  </div>
                  <TemplateLogList warnings={leftoverNotes} fontOverrides={fontOverrides} />
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
