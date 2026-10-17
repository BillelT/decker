import { useEffect } from 'preact/hooks';
import { logEntryFlag, logEntryTagText, logEntryTooltip } from './logEntryFlag.js';
import { placeholderRoleTagsForKind } from './placeholderRoleOptions.js';
import { usePacedExportCursor } from './pacedExportCursor.js';
import { RetroExportPreview } from './RetroExportPreview.js';
import { EmptyStateDemo } from './EmptyStateDemo.js';
import { Toast } from './StatusIcon.js';
import { splitCompositionRows } from './compositionRows.js';
import { useRailReorder } from './useRailReorder.js';
import { TemplateStylePanel, type TemplateStylePanelProps } from './TemplateStylePanel.js';
import type { ExportCursor } from './exportCursor.js';
import { postToPlugin, selectSourceNodes, type Notice, type TemplateElement, type TemplateLayoutState, type TemplateWarning } from './types.js';
import { CANONICAL_TAG_FOR_ROLE } from '../serialize/placeholder.js';
import { COMPOSITION_WARNING_CODES } from '../serialize/templateComposition.js';
import { hasPrepareFixableBlocking } from '../serialize/templateValidation.js';
import { suggestPlaceholderRoles } from '../serialize/templatePlaceholderRoles.js';
import type { PlaceholderRole } from '@figma-to-slides/shared';

const SUGGESTION_PLURALS = new Intl.PluralRules('en');

/** `tag` vide = option "No role" : le sandbox retire le tag du calque au lieu d'en poser un. */
function setPlaceholderRole(sourceNodeId: string, tag: string): void {
  postToPlugin({ type: 'set-placeholder-role', sourceNodeId, tag });
}

/**
 * Lignes de calques du rapport de template, communes aux listes
 * "Composition" (calques avec un rôle de placeholder) et "Content" (les
 * autres) : nom, note de fidélité éventuelle, et le sélecteur pour poser,
 * changer ou retirer le rôle. Le rôle n'est écrit qu'une fois, dans le
 * sélecteur (l'ancienne puce "TITLE" le répétait sur la même ligne).
 *
 * `noteByNode` : la note de fidélité (police substituée, radius approximé…)
 * du calque, affichée en tag à côté du sélecteur plutôt que répétée dans
 * "Notes". Construit par le parent, qui n'y met que les notes AVEC tag
 * court : un message générique ne tiendrait pas sur cette ligne et reste
 * dans "Notes".
 *
 * `conflicts` : les problèmes de composition du calque (rôle en double,
 * rôle incompatible avec un calque qui n'est pas du texte…), voir
 * compositionRows.ts. La ligne prend une bordure rouge et la raison
 * s'écrit sous le nom : la couleur ne porte jamais seule le sens.
 */
function TemplateElementList({
  elements,
  noteByNode,
  conflicts,
  master = false,
}: {
  elements: TemplateElement[];
  noteByNode: Map<string, { flag: 'rasterized' | 'visual-diff'; text: string; tooltip: string }>;
  conflicts?: Map<string, string[]>;
  /** Frame Master : pas de rôle à choisir, chaque ligne dit si le calque sera modifiable sur les slides ou fixe. */
  master?: boolean;
}) {
  return (
    <ul className="f2s-tmpl-list">
      {elements.map((el) => {
        const role = el.role as PlaceholderRole | undefined;
        const roleTag = role ? CANONICAL_TAG_FOR_ROLE[role] : undefined;
        const note = noteByNode.get(el.sourceNodeId);
        const problems = conflicts?.get(el.sourceNodeId);
        // Le rôle courant reste dans la liste même s'il ne convient pas au
        // type de calque (tag posé à la main dans Figma) : sans lui, le
        // sélecteur afficherait un autre rôle que celui du calque.
        const tags = placeholderRoleTagsForKind(el.kind);
        const options = roleTag && !tags.includes(roleTag) ? [...tags, roleTag] : tags;
        return (
          <li key={el.id} className={`f2s-log-entry${problems ? ' f2s-log-entry--wrap f2s-log-entry--conflict' : ''}`}>
            <button
              type="button"
              className="f2s-log-entry-clickarea"
              title={[note ? note.tooltip : el.label ? `${el.name} (${el.label})` : el.name, ...(problems ?? [])].join('\n')}
              onClick={() => selectSourceNodes([el.sourceNodeId])}
            >
              <span className="f2s-log-entry-text">
                <strong className="f2s-log-entry-name">{el.name}</strong>
                {problems && <span className="f2s-log-entry-message">{problems.join(' ')}</span>}
              </span>
              {note && <span className={`f2s-log-entry-flag f2s-log-entry-flag--${note.flag}`}>{note.text}</span>}
            </button>
            {master ? (
              <span className={`f2s-log-entry-flag f2s-log-entry-flag--${isEditableOnSlides(el) ? 'visual-diff' : 'rasterized'}`}>
                {isEditableOnSlides(el) ? 'Editable on slides' : 'Fixed'}
              </span>
            ) : (
              <select
                className="f2s-font-dropdown f2s-log-entry-role"
                value={roleTag ?? ''}
                title="Assign this layer to a Slides template placeholder role"
                aria-label={`Placeholder role for ${el.name}`}
                aria-invalid={problems ? true : undefined}
                onChange={(e) => setPlaceholderRole(el.sourceNodeId, (e.target as HTMLSelectElement).value)}
              >
                <option value="">No role</option>
                {options.map((tag) => (
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

/** Sur le Master, un texte devient un placeholder de chaque layout, sauf une mention légale (backend mapper/templateLayouts.ts::withMasterPlaceholders). */
function isEditableOnSlides(el: TemplateElement): boolean {
  return el.kind === 'text' && !!el.text && el.text.chars > 0 && !el.text.fixed;
}

/**
 * Rendu d'une liste de warnings (bloquants ou non) au même aspect que le
 * panneau Logs du mode deck (DeckPanel.tsx) : même structure de bouton,
 * même troncature sur une ligne pour le nom de calque, tag à droite.
 *
 * Purement informatif : l'assignation d'un rôle de placeholder vit dans les
 * listes "Composition" et "Content" (`TemplateElementList`), qui couvrent
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

export interface TemplatePanelProps extends TemplateStylePanelProps {
  order: string[];
  setOrder: (updater: (prev: string[]) => string[]) => void;
  layouts: Record<string, TemplateLayoutState>;
  activeId: string | undefined;
  setActiveId: (id: string) => void;
  notice: Notice | undefined;
  /** Ferme le toast (croix, ou fin de sa durée d'affichage). */
  onDismissNotice: () => void;
  /** Création en cours : rail figé (retrait, réordonnancement, renommage), voir DeckPanel. */
  locked: boolean;
  /** Layouts en échec de la dernière création (id → message du lot), voir ui.tsx. */
  failedSlides: Record<string, string> | undefined;
  /** L'export est conclu ET l'aperçu a fini de défiler : le succès peut s'annoncer (voir ui.tsx). */
  onPreviewSettled: () => void;
  /** Slide affichée par l'aperçu d'export, à chaque pas : le bouton principal en tire « Exporting 2/4 » (voir ui.tsx). */
  onPacedCursorChange: (cursor: ExportCursor | undefined) => void;
  onRemove: (id: string) => void;
  /** « Prepare this layout » : reformate ce seul layout pour Slides, comme « Prepare for Slides » (voir ui.tsx). */
  onPrepareLayout: (id: string) => void;
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
  notice,
  onDismissNotice,
  locked,
  failedSlides,
  onPreviewSettled,
  onRemove,
  onPrepareLayout,
  onRename,
  onRenameCommit,
  fontOverrides,
  setFontOverrides,
  exportCursor,
  exportAttempt,
  exportConcluded,
  colors,
  fonts,
  colorRoles,
  setColorRoles,
  onNotice,
  onPacedCursorChange,
}: TemplatePanelProps) {
  const { itemRefs, itemState, registerItem, onThumbPointerDown, onThumbKeyDown, announcement } = useRailReorder(order, setOrder, locked);

  // L'aside reste affiché même sans layout : il marque le mode template, et
  // ses sections vides disent ce qu'elles montreront.
  const masterLayout = order.length >= 2 ? layouts[order[0]] : undefined;
  const styleAside = (
    <TemplateStylePanel
      master={masterLayout ? { name: masterLayout.name, elements: masterLayout.elements } : undefined}
      colors={colors}
      fonts={fonts}
      fontOverrides={fontOverrides}
      setFontOverrides={setFontOverrides}
      colorRoles={colorRoles}
      setColorRoles={setColorRoles}
      onNotice={onNotice}
    />
  );

  const activeLayout = activeId ? layouts[activeId] : undefined;
  // Aperçu d'export "paced" — voir DeckPanel et pacedExportCursor.ts.
  const pacedCursor = usePacedExportCursor(exportAttempt, order, exportCursor, exportConcluded);
  const pacedIndex = pacedCursor?.index;
  const pacedTotal = pacedCursor?.total;
  useEffect(() => {
    onPacedCursorChange(pacedCursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacedIndex, pacedTotal]);
  // Pendant une création de template, l'aperçu suit le layout dont le lot
  // est en cours d'application plutôt que la sélection du rail — même
  // logique que DeckPanel.
  const exportingLayout = pacedCursor ? layouts[pacedCursor.frameId] : undefined;
  const previewedLayout = exportingLayout ?? activeLayout;
  const highlightedId = pacedCursor?.frameId ?? activeId;
  const previewedFailure = previewedLayout ? failedSlides?.[previewedLayout.id] : undefined;

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
  // utile pendant une création de template plus longue que la hauteur
  // visible du rail.
  useEffect(() => {
    if (!highlightedId) return;
    itemRefs.current.get(highlightedId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightedId]);

  /** Voir le commentaire équivalent dans DeckPanel.selectFrame : un clic de
   *  navigation dans le rail ne doit pas faire sauter le canvas Figma. */
  function selectLayout(id: string) {
    setActiveId(id);
  }

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

  // Composition = calques avec un rôle, Content = les autres ; un conflit
  // de composition marque la ligne de son calque (voir compositionRows.ts).
  // "Aucun placeholder" n'a pas de ligne : la section vide le dit déjà.
  const rows = splitCompositionRows(previewedLayout?.elements ?? [], compositionWarnings);
  const unattachedComposition = rows.unattached.filter((w) => w.code !== 'LAYOUT_WITHOUT_PLACEHOLDER');

  // Sur le Master, rien à suggérer : chaque texte devient automatiquement un
  // placeholder de chaque layout (backend mapper/templateLayouts.ts::withMasterPlaceholders).
  const previewingMaster = order.length >= 2 && previewedLayout?.id === order[0];
  const placeholderSuggestions = previewingMaster ? [] : suggestPlaceholderRoles(previewedLayout?.elements ?? []);
  function applyPlaceholderSuggestions() {
    for (const { sourceNodeId, tag } of placeholderSuggestions) setPlaceholderRole(sourceNodeId, tag);
    const count = placeholderSuggestions.length;
    onNotice(`${count} ${SUGGESTION_PLURALS.select(count) === 'one' ? 'role' : 'roles'} suggested. Change any of them in Composition.`);
  }
  // Retire d'un coup tous les rôles du layout affiché (tags Figma compris),
  // pour repartir de zéro après un Suggest roles qui ne convient pas.
  function clearPlaceholderRoles() {
    for (const el of rows.tagged) setPlaceholderRole(el.sourceNodeId, '');
    const count = rows.tagged.length;
    onNotice(`${count} ${SUGGESTION_PLURALS.select(count) === 'one' ? 'role' : 'roles'} cleared.`);
  }

  if (order.length === 0) {
    return (
      <div className="f2s-body">
        {notice && <Toast key={notice.id} notice={notice} onDismiss={onDismissNotice} />}
        <main className="f2s-canvas">
          {/* Même état vide que le deck (DeckPanel), pour le parcours template. */}
          <EmptyStateDemo actionLabel="Create template" description="Select frames on the Figma canvas, click Add, then Create template to build it in Google Slides." />
        </main>
        <aside className="f2s-style-aside">
          {styleAside}
        </aside>
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
          const layout = layouts[id];
          if (!layout) return null;
          const item = itemState(id, index);
          // Même pastille que le Deck : rouge « 3 to fix » quand des problèmes
          // bloquent la création, sinon grise « 2 rasterized » pour ce qui
          // partira en image sans bloquer (icône, illustration).
          const toFix = layout.warnings.filter((w) => w.severity === 'blocking').length;
          const rasterized = layout.warnings.filter((w) => w.severity !== 'blocking' && logEntryFlag(w.code) === 'rasterized').length;
          return (
            <div key={id} ref={registerItem(id)} className={item.className} style={item.style}>
              <button
                type="button"
                className={`f2s-frame-preview${highlightedId === id ? ' is-active' : ''}${layout.blocking ? ' f2s-frame-preview--blocking' : ''}${failure ? ' f2s-frame-preview--failed' : ''}${pacedCursor?.frameId === id ? ' is-exporting' : ''}`}
                onClick={() => selectLayout(id)}
                onPointerDown={(e) => onThumbPointerDown(e, id)}
                onKeyDown={(e) => onThumbKeyDown(e, id)}
                aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                title={
                  failure
                    ? `Export failed: ${failure}`
                    : layout.blocking
                      ? 'This layout has issues to fix. Open it to see the details.'
                      : undefined
                }
              >
                {layout.previewDataUrl && <img src={layout.previewDataUrl} alt={layout.name} draggable={false} />}
                {/* Comme dans Slides : le premier layout est le Master dès
                    qu'il y en a deux. Il suit le rail (suppression, drag). */}
                {index === 0 && order.length >= 2 && <span className="f2s-frame-tag f2s-frame-tag--master">Master</span>}
                {layout.blocking && toFix > 0 ? (
                  <span className="f2s-frame-badge f2s-frame-badge--error f2s-tabular">{toFix} to fix</span>
                ) : (
                  rasterized > 0 && <span className="f2s-frame-badge f2s-tabular">{rasterized} rasterized</span>
                )}
              </button>
              <div className="f2s-frame-info">
                <span className="f2s-frame-index">{index + 1}.</span>
                <input
                  type="text"
                  className="f2s-frame-name-input"
                  value={layout.name}
                  title={layout.name}
                  aria-label="Layout name"
                  readOnly={locked}
                  onInput={(e) => onRename(id, (e.target as HTMLInputElement).value)}
                  onChange={(e) => onRenameCommit(id, (e.target as HTMLInputElement).value)}
                  onBlur={(e) => onRenameCommit(id, (e.target as HTMLInputElement).value)}
                />
                <div className="f2s-frame-controls">
                  <button
                    type="button"
                    className="f2s-icon-btn"
                    disabled={locked}
                    title={locked ? 'An export is running. Wait for it to finish before changing the list.' : `Remove layout ${index + 1}`}
                    aria-label={`Remove layout ${index + 1}`}
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

      <main className="f2s-canvas f2s-canvas--template">
        {previewedLayout ? (
          <div className="f2s-tmpl-report">
            {previewedFailure && !exportingLayout && (
              <div className="f2s-logs f2s-tmpl-section--blocking f2s-export-failure" role="alert">
                <div className="f2s-logs-header">
                  <h3 className="f2s-tmpl-heading">This layout failed to export</h3>
                </div>
                <p className="f2s-export-failure-message">{previewedFailure}</p>
              </div>
            )}
            {blockingWarnings.length > 0 && (
              <div className="f2s-logs f2s-tmpl-section--blocking">
                <div className="f2s-logs-header">
                  <h3 className="f2s-tmpl-heading">Fix before creating the template</h3>
                  {/* Même reformatage que « Prepare for Slides », sur ce seul
                      layout. Seulement si un des blocages fait partie de ce
                      qu'il corrige : sinon le bouton ne changerait rien. */}
                  {hasPrepareFixableBlocking(blockingWarnings) && (
                    <button
                      type="button"
                      className="f2s-btn f2s-btn--ghost"
                      disabled={locked}
                      title="Duplicate this layout and reformat it for Slides: gradients, shadows, letter spacing and missing fonts are fixed automatically."
                      onClick={() => onPrepareLayout(previewedLayout.id)}
                    >
                      Prepare this layout
                    </button>
                  )}
                </div>
                <TemplateLogList warnings={blockingWarnings} fontOverrides={fontOverrides} />
              </div>
            )}

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
              {previewingMaster ? (
                // Master : rien à taguer (décision du 17 octobre), le
                // partage est automatique, voir isEditableOnSlides.
                <section className="f2s-tmpl-section">
                  <h3 className="f2s-tmpl-heading">Master content</h3>
                  <p className="f2s-toolbar-muted">
                    Automatic on the Master: every text becomes editable on each slide, at the same place and in the same style. Legal mentions (©,
                    copyright), logos, images and shapes stay fixed on every slide.
                  </p>
                  {previewedLayout.elements.length > 0 && <TemplateElementList elements={previewedLayout.elements} noteByNode={noteByNode} master />}
                </section>
              ) : (
                <>
                {/* Composition (TODO.md § Mode template, point 7) : les calques qui
                    deviendront des placeholders. Un calque y passe dès qu'il reçoit
                    un rôle, et revient dans Content quand on le lui retire. */}
                <section className="f2s-tmpl-section">
                  <div className="f2s-section-head">
                    <h3 className="f2s-tmpl-heading">Composition</h3>
                    {/* Propose title, subtitle et body d'après la taille et la
                        longueur des textes de CE layout, sans toucher à un
                        calque qui a déjà un rôle (templatePlaceholderRoles.ts).
                        Chaque rôle posé reste modifiable dans sa ligne. */}
                    <div className="f2s-section-actions">
                      <button
                        type="button"
                        className="f2s-btn f2s-btn--ghost"
                        disabled={locked || rows.tagged.length === 0}
                        title="Remove the role of every layer in this layout."
                        onClick={clearPlaceholderRoles}
                      >
                        Clear roles
                      </button>
                      <button
                        type="button"
                        className="f2s-btn f2s-btn--ghost"
                        disabled={locked || placeholderSuggestions.length === 0}
                        title={
                          previewingMaster
                            ? 'Tag a Master text yourself to make it editable on every slide. Untagged layers stay fixed on every slide.'
                            : placeholderSuggestions.length === 0
                            ? 'Nothing left to suggest in this layout: its title, subtitle and body are set, or no other text fits them.'
                            : 'Tag the title, subtitles, bodies and images of this layout from the size and length of its texts.'
                        }
                        onClick={applyPlaceholderSuggestions}
                      >
                        Suggest roles
                      </button>
                    </div>
                  </div>
                  {rows.tagged.length === 0 ? (
                    <p className="f2s-toolbar-muted">No placeholder yet. Pick a role for a layer in Content.</p>
                  ) : (
                    <TemplateElementList elements={rows.tagged} noteByNode={noteByNode} conflicts={rows.conflicts} />
                  )}
                  {unattachedComposition.length > 0 && <TemplateLogList warnings={unattachedComposition} fontOverrides={fontOverrides} wrap />}
                </section>

                <section className="f2s-tmpl-section">
                  <h3 className="f2s-tmpl-heading">Content</h3>
                  {previewedLayout.elements.length === 0 ? (
                    <p className="f2s-toolbar-muted">
                      Nothing to tag in this layout yet. A placeholder can also be set by prefixing a layer name in Figma with <code>[[title]]</code>,{' '}
                      <code>[[body]]</code>, <code>[[image]]</code>, <code>[[subtitle]]</code> or <code>[[logo]]</code>.
                    </p>
                  ) : rows.untagged.length === 0 ? (
                    <p className="f2s-toolbar-muted">Every layer has a role.</p>
                  ) : (
                    <TemplateElementList elements={rows.untagged} noteByNode={noteByNode} />
                  )}
                </section>
                </>
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
        {styleAside}
      </aside>
    </div>
  );
}
