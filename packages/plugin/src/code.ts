import type { ExportOptions, IRDocument, IRSlide } from '@figma-to-slides/shared';
import { createIdGenerator } from './serialize/ids.js';
import { serializeFrame } from './serialize/serializeFrame.js';

const MAX_FRAMES_WARNING = 20;
const PREVIEW_WIDTH = 320;

type ExportableNode = FrameNode | ComponentNode | InstanceNode;

function isExportable(node: SceneNode): node is ExportableNode {
  return node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE';
}

/** Spec §7.0.1 — sélection au lancement, sinon toutes les frames de premier niveau. */
function collectCandidateFrames(): { included: ExportableNode[]; excluded: { name: string; reason: string }[] } {
  const selection = figma.currentPage.selection.filter((n) => n.parent?.type === 'PAGE');
  const source = selection.length > 0 ? selection : figma.currentPage.children;

  const included: ExportableNode[] = [];
  const excluded: { name: string; reason: string }[] = [];

  for (const node of source) {
    if (isExportable(node)) {
      included.push(node);
    } else {
      excluded.push({ name: node.name, reason: `Type non exportable : ${node.type}` });
    }
  }

  return { included, excluded };
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
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

async function main(): Promise<void> {
  figma.showUI(__html__, { width: 480, height: 640 });

  const { included, excluded } = collectCandidateFrames();

  figma.ui.postMessage({ type: 'candidates', frames: included.map((f) => ({ id: f.id, name: f.name, width: f.width, height: f.height })), excluded });

  if (included.length > MAX_FRAMES_WARNING) {
    figma.ui.postMessage({ type: 'too-many-frames', count: included.length, max: MAX_FRAMES_WARNING });
  }

  // Spec §7.0 RÈGLE performance : séquentiel avec yield entre chaque frame,
  // pour ne jamais figer l'UI Figma plus de 200ms d'affilée (§7.0 CRITÈRE).
  const pending: PendingSlide[] = [];
  const idGen = createIdGenerator(figma.root.id.slice(0, 8));

  for (const frame of included) {
    const previewDataUrl = await generatePreview(frame);
    figma.ui.postMessage({ type: 'preview', frameId: frame.id, previewDataUrl });
    await yieldToUi();

    const { slide, nodesToRaster } = await serializeFrame(frame, { nextId: idGen });
    pending.push({ frame, slide, nodesToRaster });

    const nativeCount = slide.elements.filter((e) => e.kind !== 'image' || !e.isRasterFallback).length;
    const rasterCount = slide.elements.length - nativeCount;
    figma.ui.postMessage({
      type: 'analysis',
      frameId: frame.id,
      nativeCount,
      rasterCount,
      warnings: slide.warnings,
    });
    await yieldToUi();
  }

  figma.ui.onmessage = async (msg: { type: string; [key: string]: unknown }) => {
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
      await handleExportRequest(
        msg as unknown as { includedFrameIds: string[]; order: string[]; options: ExportOptions; presentationTitle: string },
        pending,
      );
    }
  };
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
      const bytes = await node.exportAsync({ format: 'PNG', constraint: scaleConstraint });
      assets.push({ assetKey, bytes, mimeType: 'image/png' });
      await yieldToUi();
    }

    slides.push({ ...p.slide, order: i, previewDataUrl: '' });
  }

  const doc: IRDocument = {
    version: 1,
    presentationTitle: msg.presentationTitle,
    slideSize: { widthPt: 720, heightPt: 405 },
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
