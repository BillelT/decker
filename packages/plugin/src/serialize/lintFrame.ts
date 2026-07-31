import { classifyNode } from './decisionTree.js';
import { extractTextRuns } from './textExtract.js';
import { toDecisionInput } from './serializeFrame.js';

export interface LintWarning {
  nodeId: string;
  nodeName: string;
  code: string;
  message: string;
}

/**
 * Brief "copie de vérification" (§ Approche retenue) — parcourt la copie
 * posée sur le canvas Figma avec le MÊME arbre de décision natif/raster que
 * l'export réel (`decisionTree.ts`), mais ne construit aucun IR : le seul
 * but ici est de savoir quels calques seraient rasterisés à l'export, pour
 * les signaler par une annotation sur le canvas avant que l'utilisateur ne
 * clique sur "Export to Slides".
 */
export async function lintFrame(frame: FrameNode | ComponentNode | InstanceNode): Promise<LintWarning[]> {
  const warnings: LintWarning[] = [];
  for (const child of frame.children) {
    await walk(child, warnings, false);
  }
  return warnings;
}

async function walk(node: SceneNode, warnings: LintWarning[], maskedByAncestor: boolean): Promise<void> {
  const decision = classifyNode(toDecisionInput(node, maskedByAncestor));

  switch (decision.action) {
    case 'raster':
      warnings.push({ nodeId: node.id, nodeName: node.name, code: decision.warningCode, message: decision.message });
      return;

    case 'native-text': {
      const extraction = extractTextRuns(node as TextNode);
      if (extraction.requiresRaster) {
        warnings.push({
          nodeId: node.id,
          nodeName: node.name,
          code: 'LETTER_SPACING_LOST',
          message: extraction.rasterReason ?? 'Texte non représentable — sera converti en image.',
        });
      }
      return;
    }

    case 'descend': {
      const container = node as FrameNode | GroupNode | ComponentNode | InstanceNode;
      for (const child of container.children) {
        await walk(child, warnings, maskedByAncestor);
      }
      return;
    }

    default:
      return;
  }
}
