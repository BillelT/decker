import type { ExportOptions, IRDocument, IRSlide } from '@figma-to-slides/shared';
import { createIdGenerator } from './serialize/ids.js';
import { serializeFrame } from './serialize/serializeFrame.js';
import { lintFrame, type LintWarning } from './serialize/lintFrame.js';

const MAX_FRAMES_WARNING = 20;
// 320px produisait un aperçu visiblement pixellisé une fois agrandi dans le
// grand canvas de l'UI (jusqu'à 640px CSS, donc ~1280px physiques en HiDPI).
const PREVIEW_WIDTH = 960;

// Brief "copie de vérification" — donnée stockée directement dans le
// fichier Figma (survit à la fermeture du plugin/fichier, contrairement à
// localStorage/sessionStorage dans l'iframe) pour retrouver les frames
// prêtes à l'export sans dépendre de la sélection courante.
const SLIDES_READY_KEY = 'slidesExportReady';
const LINT_GROUP_ID_KEY = 'slidesLintGroupId';
const SLIDES_READY_PREFIX = '[Slides Ready] ';
const COPY_GAP_PX = 200;

type ExportableNode = FrameNode | ComponentNode | InstanceNode;

function isExportable(node: SceneNode): node is ExportableNode {
  return node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE';
}

function isSlidesReady(node: SceneNode): boolean {
  return node.getPluginData(SLIDES_READY_KEY) === 'true';
}

function stripReadyPrefix(name: string): string {
  return name.startsWith(SLIDES_READY_PREFIX) ? name.slice(SLIDES_READY_PREFIX.length) : name;
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Linter visuel (brief export ponctuel) : au lieu de faire chercher à
 * l'utilisateur les substitutions de police dans le texte des warnings,
 * on les extrait ici sous forme structurée pour l'en-tête "Polices" de
 * l'UI (une paire par famille remplacée, dédupliquée).
 */
function collectFontSubstitutions(slide: PendingSlide['slide']): { original: string; resolved: string }[] {
  const seen = new Set<string>();
  const subs: { original: string; resolved: string }[] = [];
  for (const el of slide.elements) {
    if (el.kind !== 'text') continue;
    for (const run of el.runs) {
      if (!run.originalFontFamily) continue;
      const key = `${run.originalFontFamily}→${run.fontFamily}`;
      if (seen.has(key)) continue;
      seen.add(key);
      subs.push({ original: run.originalFontFamily, resolved: run.fontFamily });
    }
  }
  return subs;
}

/** Applique le choix manuel de police fait dans le select "Fonts" de l'UI, par famille d'origine. */
function applyFontOverrides(slide: PendingSlide['slide'], overrides: Record<string, string>): void {
  if (Object.keys(overrides).length === 0) return;
  for (const el of slide.elements) {
    if (el.kind !== 'text') continue;
    for (const run of el.runs) {
      const override = run.originalFontFamily && overrides[run.originalFontFamily];
      if (override) run.fontFamily = override;
    }
  }
}

async function generatePreview(node: ExportableNode): Promise<string> {
  const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'WIDTH', value: PREVIEW_WIDTH } });
  return `data:image/png;base64,${figma.base64Encode(bytes)}`;
}

interface PendingSlide {
  frame: ExportableNode;
  slide: Omit<IRSlide, 'order' | 'previewDataUrl'>;
  nodesToRaster: Map<string, SceneNode[]>;
}

/**
 * Ajoute au deck une liste de frames déjà résolues (pas de doublon avec ce
 * qui est déjà dans `pending`) — logique commune à l'ajout manuel (sélection
 * sur le canvas) et à la découverte automatique des frames taguées
 * `slidesExportReady` au lancement du plugin (brief §"Nouveau flux proposé"
 * point 5 : aucune re-sélection manuelle requise).
 */
async function addFrames(nodes: ExportableNode[], pending: PendingSlide[], idGen: ReturnType<typeof createIdGenerator>): Promise<void> {
  const known = new Set(pending.map((p) => p.frame.id));
  const toAdd = nodes.filter((n) => !known.has(n.id));
  if (toAdd.length === 0) return;
  if (toAdd.length > MAX_FRAMES_WARNING) {
    figma.ui.postMessage({ type: 'too-many-frames', count: toAdd.length, max: MAX_FRAMES_WARNING });
  }

  // Spec §7.0 RÈGLE performance : séquentiel avec yield entre chaque frame,
  // pour ne jamais figer l'UI Figma plus de 200ms d'affilée (§7.0 CRITÈRE).
  for (const frame of toAdd) {
    const previewDataUrl = await generatePreview(frame);
    const { slide, nodesToRaster } = await serializeFrame(frame, { nextId: idGen });
    pending.push({ frame, slide, nodesToRaster });

    const nativeCount = slide.elements.filter((e) => e.kind !== 'image' || !e.isRasterFallback).length;
    const rasterCount = slide.elements.length - nativeCount;
    figma.ui.postMessage({
      type: 'candidate-added',
      frame: { id: frame.id, name: frame.name, width: frame.width, height: frame.height },
      previewDataUrl,
      nativeCount,
      rasterCount,
      warnings: slide.warnings,
      fontSubstitutions: collectFontSubstitutions(slide),
    });
    await yieldToUi();
  }
}

/**
 * Ajoute au deck les frames actuellement sélectionnées sur le canvas Figma
 * (déclenché par le bouton « Select frames to add » de l'UI) — l'utilisateur
 * choisit explicitement quoi exporter et dans quel ordre construire sa liste.
 */
async function addSelectedFrames(pending: PendingSlide[], idGen: ReturnType<typeof createIdGenerator>): Promise<void> {
  const selected = figma.currentPage.selection.filter(isExportable);
  if (selected.length === 0) {
    figma.ui.postMessage({ type: 'no-frames-selected' });
    return;
  }
  await addFrames(selected, pending, idGen);
}

/**
 * Brief "Nouveau flux proposé" point 5 — retrouve automatiquement, sans
 * dépendre de la sélection courante, les frames taguées `slidesExportReady`
 * lors d'une session précédente (copie de vérification retravaillée sur le
 * canvas puis plugin fermé/rouvert).
 */
async function loadTaggedFrames(pending: PendingSlide[], idGen: ReturnType<typeof createIdGenerator>): Promise<void> {
  const tagged = figma.currentPage.findAll((n) => isExportable(n) && isSlidesReady(n)) as ExportableNode[];
  if (tagged.length === 0) return;
  await addFrames(tagged, pending, idGen);
}

/**
 * Aplatit récursivement l'auto-layout de la copie — Slides n'a pas
 * d'équivalent et l'export bake déjà les positions au moment du batchUpdate
 * (LIMITATIONS.md) ; désactiver l'auto-layout ICI, sur la copie de
 * vérification, fige les positions actuelles sans bouger un seul pixel
 * (Figma préserve les positions courantes des enfants en désactivant le
 * mode) — évite qu'un redimensionnement accidentel de la copie pendant le
 * "refine pixel perfect" ne réagence tout le contenu.
 */
function flattenAutoLayout(node: SceneNode): void {
  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    node.layoutMode = 'NONE';
  }
  if ('children' in node) {
    for (const child of node.children) flattenAutoLayout(child);
  }
}

/** Retire l'annotation de lint précédente de cette copie, le cas échéant (évite l'accumulation à chaque re-préparation). */
async function removeLintAnnotations(copy: ExportableNode): Promise<void> {
  const groupId = copy.getPluginData(LINT_GROUP_ID_KEY);
  if (!groupId) return;
  const group = await figma.getNodeByIdAsync(groupId);
  if (group && !group.removed) group.remove();
  copy.setPluginData(LINT_GROUP_ID_KEY, '');
}

/**
 * Brief "Approche retenue" — linter visuel : place un repère rouge au
 * coin haut-droit de chaque calque qui serait rasterisé à l'export, en
 * SIBLING de la copie (jamais un enfant) pour ne jamais polluer le contenu
 * réellement exporté. Positionné en coordonnées absolues (repère direct
 * enfant de la page), donc correct même si la copie est imbriquée.
 */
async function addLintAnnotations(copy: ExportableNode, warnings: LintWarning[]): Promise<void> {
  await removeLintAnnotations(copy);
  if (warnings.length === 0) return;

  const badges: EllipseNode[] = [];
  for (const w of warnings) {
    const node = await figma.getNodeByIdAsync(w.nodeId);
    if (!node || !('absoluteBoundingBox' in node) || !node.absoluteBoundingBox) continue;
    const box = node.absoluteBoundingBox;
    const badge = figma.createEllipse();
    badge.resize(10, 10);
    badge.x = box.x + box.width - 5;
    badge.y = box.y - 5;
    badge.fills = [{ type: 'SOLID', color: { r: 0.94, g: 0.23, b: 0.18 } }];
    badge.strokes = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    badge.strokeWeight = 1;
    badge.name = `⚠ ${w.nodeName} — ${w.message}`;
    badges.push(badge);
  }
  if (badges.length === 0) return;

  const group = badges.length > 1 ? figma.group(badges, figma.currentPage) : badges[0];
  group.name = `Slides lint — ${stripReadyPrefix(copy.name)}`;
  group.locked = true;
  if ('expanded' in group) group.expanded = false;
  copy.setPluginData(LINT_GROUP_ID_KEY, group.id);
}

/**
 * Brief "Nouveau flux proposé" points 2-3 — génère (ou retravaille, si la
 * sélection est déjà une copie taguée) la copie de vérification : dupliquée
 * à côté de l'originale, taguée `slidesExportReady`, préfixée dans son nom,
 * auto-layout aplati, puis relintée pour poser les annotations à jour.
 */
async function prepareFrameForSlides(source: ExportableNode): Promise<{ copy: ExportableNode; warnings: LintWarning[] }> {
  let copy: ExportableNode;
  if (isSlidesReady(source)) {
    copy = source;
  } else {
    const clone = source.clone();
    if (!isExportable(clone)) throw new Error(`Unexpected clone type for "${source.name}"`);
    copy = clone;
    copy.x = source.x + source.width + COPY_GAP_PX;
    copy.y = source.y;
    copy.name = SLIDES_READY_PREFIX + stripReadyPrefix(source.name);
    copy.setPluginData(SLIDES_READY_KEY, 'true');
  }

  flattenAutoLayout(copy);
  const warnings = await lintFrame(copy);
  await addLintAnnotations(copy, warnings);
  return { copy, warnings };
}

/**
 * Handler du bouton "Prepare for Slides" — prépare une copie de vérification
 * par frame sélectionnée, recentre le canvas Figma dessus (c'est la
 * "preview" : l'utilisateur voit tout de suite la version reformatée posée
 * à côté de l'originale, prête pour le "refine pixel perfect"), puis
 * l'ajoute aussi au panneau du plugin comme le ferait "Add selection".
 */
async function handlePrepareForSlides(pending: PendingSlide[], idGen: ReturnType<typeof createIdGenerator>): Promise<void> {
  const selected = figma.currentPage.selection.filter(isExportable);
  if (selected.length === 0) {
    figma.notify('Select at least one frame on the canvas first.', { error: true });
    return;
  }

  const copies: ExportableNode[] = [];
  let totalWarnings = 0;
  for (const frame of selected) {
    const { copy, warnings } = await prepareFrameForSlides(frame);
    copies.push(copy);
    totalWarnings += warnings.length;
    await yieldToUi();
  }

  figma.currentPage.selection = copies;
  figma.viewport.scrollAndZoomIntoView(copies);

  const label = copies.length === 1 ? 'frame' : 'frames';
  figma.notify(
    totalWarnings === 0
      ? `Prepared ${copies.length} ${label} for Slides — no issues found.`
      : `Prepared ${copies.length} ${label} for Slides — ${totalWarnings} issue(s) flagged on canvas (red markers).`,
  );

  await addFrames(copies, pending, idGen);
}

async function main(): Promise<void> {
  // Layout à deux colonnes (rail de miniatures + canvas) : plus large que
  // l'ancien panneau vertical, pour laisser une vraie zone de prévisualisation.
  figma.showUI(__html__, { width: 900, height: 600 });

  const pending: PendingSlide[] = [];
  const idGen = createIdGenerator(figma.root.id.slice(0, 8));

  // Permet à l'UI de masquer son hint « sélectionne des frames sur le
  // canvas » dès qu'une sélection exportable existe déjà, plutôt que de le
  // garder affiché même une fois l'action faite.
  figma.on('selectionchange', () => {
    figma.ui.postMessage({
      type: 'canvas-selection-changed',
      hasSelection: figma.currentPage.selection.some(isExportable),
    });
  });

  figma.ui.onmessage = async (msg: { type: string; [key: string]: unknown }) => {
    if (msg.type === 'ui-ready') {
      // Brief "Nouveau flux proposé" point 5 — un `figma.ui.postMessage`
      // envoyé avant que l'iframe UI n'ait fini de charger son JS est
      // perdu (pas de mise en tampon côté `postMessage`) : on attend que
      // l'UI signale son montage avant de lui pousser les frames taguées
      // trouvées via `findAll`.
      //
      // On envoie aussi l'état de sélection courant : le bouton "Prepare
      // for Slides" en dépend dès le premier rendu, et l'événement
      // `selectionchange` ne se redéclenche pas si la sélection existait
      // déjà avant l'ouverture du plugin.
      figma.ui.postMessage({
        type: 'canvas-selection-changed',
        hasSelection: figma.currentPage.selection.some(isExportable),
      });
      try {
        await loadTaggedFrames(pending, idGen);
      } catch (err) {
        console.error(err);
      }
      return;
    }

    if (msg.type === 'add-selected-frames') {
      try {
        await addSelectedFrames(pending, idGen);
      } catch (err) {
        console.error(err);
        figma.ui.postMessage({ type: 'export-error', message: (err as Error).message });
      }
      return;
    }

    if (msg.type === 'prepare-for-slides') {
      try {
        await handlePrepareForSlides(pending, idGen);
      } catch (err) {
        console.error(err);
        figma.notify(`Prepare for Slides failed: ${(err as Error).message}`, { error: true });
      }
      return;
    }

    if (msg.type === 'select-nodes') {
      // Spec §8.3 RÈGLE — cliquer sur une ligne du rapport sélectionne les nœuds dans Figma.
      const ids = msg.nodeIds as string[];
      const resolved = await Promise.all(ids.map((id) => figma.getNodeByIdAsync(id)));
      const nodes = resolved.filter((n): n is SceneNode => n !== null && 'x' in n);
      figma.currentPage.selection = nodes;
      figma.viewport.scrollAndZoomIntoView(nodes);
      return;
    }

    if (msg.type === 'request-export') {
      // Sans ce try/catch, une exception ici (p. ex. `exportAsync` qui
      // échoue sur un nœud dégénéré) rejette silencieusement cette promesse
      // — l'UI n'a aucun moyen de le savoir et reste bloquée indéfiniment
      // sur "analyse en cours", sans le moindre message d'erreur.
      try {
        await handleExportRequest(
          msg as unknown as {
            includedFrameIds: string[];
            order: string[];
            options: ExportOptions;
            presentationTitle: string;
            fontOverrides?: Record<string, string>;
          },
          pending,
        );
      } catch (err) {
        console.error(err);
        figma.ui.postMessage({ type: 'export-error', message: (err as Error).message });
      }
    }
  };
}

// Une présentation Slides n'a qu'une seule taille de page, fixée à la
// création (aucune requête batchUpdate ne permet de la changer ensuite) —
// on la dérive donc du ratio de la première frame plutôt que de forcer le
// 16:9 par défaut de Slides (720x405pt), qui laissait des bandes vides
// quand la frame source n'était pas déjà en 16:9. Ancré sur le plus grand
// des deux côtés pour rester dans un ordre de grandeur de points familier
// quelle que soit l'orientation de la frame.
const REFERENCE_SIDE_PT = 720;

function computeSlideSizePt(frameSize: { width: number; height: number } | undefined): { widthPt: number; heightPt: number } {
  if (!frameSize || frameSize.width <= 0 || frameSize.height <= 0) {
    return { widthPt: REFERENCE_SIDE_PT, heightPt: REFERENCE_SIDE_PT * (9 / 16) };
  }
  const { width, height } = frameSize;
  return width >= height
    ? { widthPt: REFERENCE_SIDE_PT, heightPt: REFERENCE_SIDE_PT * (height / width) }
    : { widthPt: REFERENCE_SIDE_PT * (width / height), heightPt: REFERENCE_SIDE_PT };
}

async function handleExportRequest(
  msg: {
    includedFrameIds: string[];
    order: string[];
    options: ExportOptions;
    presentationTitle: string;
    fontOverrides?: Record<string, string>;
  },
  pending: PendingSlide[],
): Promise<void> {
  const byId = new Map(pending.map((p) => [p.frame.id, p]));
  const orderedIds = msg.order.filter((id) => msg.includedFrameIds.includes(id));

  const slides: IRSlide[] = [];
  const assets: { assetKey: string; bytes: Uint8Array; mimeType: string }[] = [];

  for (let i = 0; i < orderedIds.length; i++) {
    const p = byId.get(orderedIds[i]);
    if (!p) continue;

    applyFontOverrides(p.slide, msg.fontOverrides ?? {});

    for (const [assetKey, nodes] of p.nodesToRaster) {
      const node = nodes[0];
      const scaleConstraint = { type: 'SCALE' as const, value: msg.options.rasterScale };
      try {
        const bytes = await node.exportAsync({ format: 'PNG', constraint: scaleConstraint });
        assets.push({ assetKey, bytes, mimeType: 'image/png' });
      } catch (err) {
        // Un nœud dégénéré (p. ex. une LINE dont la bounding box a une
        // largeur ou hauteur nulle sur un axe) fait échouer `exportAsync` —
        // on saute cet asset plutôt que de faire échouer tout l'export : le
        // reste des slides reste exportable, celui-ci apparaîtra juste sans
        // cette image.
        console.error(`[export] échec de rasterisation pour ${node.name} (${node.id})`, err);
      }
      await yieldToUi();
    }

    slides.push({ ...p.slide, order: i, previewDataUrl: '' });
  }

  const doc: IRDocument = {
    version: 1,
    presentationTitle: msg.presentationTitle,
    slideSize: computeSlideSizePt(slides[0]?.frameSize),
    slides,
    options: msg.options,
  };

  figma.ui.postMessage({
    type: 'export-payload',
    document: doc,
    assets: assets.map((a) => ({ assetKey: a.assetKey, mimeType: a.mimeType })),
  });

  for (const asset of assets) {
    figma.ui.postMessage({ type: 'export-asset', assetKey: asset.assetKey, bytes: asset.bytes.buffer });
  }
}

main().catch((err) => {
  console.error(err);
  figma.notify(`Erreur d'export : ${(err as Error).message}`, { error: true });
});
