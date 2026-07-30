import type { ExportOptions, IRDocument, IRSlide } from '@figma-to-slides/shared';
import { createIdGenerator } from './serialize/ids.js';
import { serializeFrame } from './serialize/serializeFrame.js';

const MAX_FRAMES_WARNING = 20;
const PREVIEW_WIDTH = 320;

type ExportableNode = FrameNode | ComponentNode | InstanceNode;

function isExportable(node: SceneNode): node is ExportableNode {
  return node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE';
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
 * Ajoute au deck les frames actuellement sélectionnées sur le canvas Figma
 * (déclenché par le bouton « Ajouter la sélection » de l'UI) — remplace
 * l'ancienne collecte automatique au lancement : l'utilisateur choisit
 * explicitement quoi exporter et dans quel ordre construire sa liste.
 * Les frames déjà présentes dans `pending` sont ignorées (pas de doublon
 * si on re-sélectionne en partie ce qui a déjà été ajouté).
 */
async function addSelectedFrames(pending: PendingSlide[], idGen: ReturnType<typeof createIdGenerator>): Promise<void> {
  const known = new Set(pending.map((p) => p.frame.id));
  const selected = figma.currentPage.selection.filter((n): n is ExportableNode => isExportable(n) && !known.has(n.id));

  if (selected.length === 0) {
    figma.ui.postMessage({ type: 'no-frames-selected' });
    return;
  }
  if (selected.length > MAX_FRAMES_WARNING) {
    figma.ui.postMessage({ type: 'too-many-frames', count: selected.length, max: MAX_FRAMES_WARNING });
  }

  // Spec §7.0 RÈGLE performance : séquentiel avec yield entre chaque frame,
  // pour ne jamais figer l'UI Figma plus de 200ms d'affilée (§7.0 CRITÈRE).
  for (const frame of selected) {
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

async function main(): Promise<void> {
  // Layout à deux colonnes (rail de miniatures + canvas) : plus large que
  // l'ancien panneau vertical, pour laisser une vraie zone de prévisualisation.
  figma.showUI(__html__, { width: 900, height: 600 });

  const pending: PendingSlide[] = [];
  const idGen = createIdGenerator(figma.root.id.slice(0, 8));

  figma.ui.onmessage = async (msg: { type: string; [key: string]: unknown }) => {
    if (msg.type === 'add-selected-frames') {
      try {
        await addSelectedFrames(pending, idGen);
      } catch (err) {
        console.error(err);
        figma.ui.postMessage({ type: 'export-error', message: (err as Error).message });
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
          msg as unknown as { includedFrameIds: string[]; order: string[]; options: ExportOptions; presentationTitle: string },
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
  msg: { includedFrameIds: string[]; order: string[]; options: ExportOptions; presentationTitle: string },
  pending: PendingSlide[],
): Promise<void> {
  const byId = new Map(pending.map((p) => [p.frame.id, p]));
  const orderedIds = msg.order.filter((id) => msg.includedFrameIds.includes(id));

  const slides: IRSlide[] = [];
  const assets: { assetKey: string; bytes: Uint8Array; mimeType: string }[] = [];

  for (let i = 0; i < orderedIds.length; i++) {
    const p = byId.get(orderedIds[i]);
    if (!p) continue;

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
