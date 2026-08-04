import { classifyNode } from './decisionTree.js';
import { extractTextRuns } from './textExtract.js';
import { toDecisionInput } from './serializeFrame.js';

export interface LintWarning {
  nodeId: string;
  nodeName: string;
  code: string;
  message: string;
  /**
   * 'rasterized' : le calque quitte l'édition native, converti en image à
   * l'export — perte d'éditabilité mais rendu identique à l'original.
   * 'visual-diff' : le calque reste natif mais Slides n'a pas d'équivalent
   * exact (police de substitution, radius approximé) — l'éditabilité est
   * préservée mais le rendu peut légèrement différer, ce qui casse plus
   * souvent la mise en page qu'une rasterisation (retour à la ligne,
   * largeur de texte) et mérite donc d'être signalé tout autant.
   */
  category: 'rasterized' | 'visual-diff';
}

/**
 * Brief "copie de vérification" (§ Approche retenue) — parcourt la copie
 * posée sur le canvas Figma avec le MÊME arbre de décision natif/raster que
 * l'export réel (`decisionTree.ts`), mais ne construit aucun IR : le but ici
 * est de savoir quels calques seraient rasterisés OU rendus avec une
 * approximation visuelle à l'export, pour les signaler par une annotation
 * sur le canvas avant que l'utilisateur ne clique sur "Export to Slides".
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
      warnings.push({ nodeId: node.id, nodeName: node.name, code: decision.warningCode, message: decision.message, category: 'rasterized' });
      return;

    case 'native-text': {
      const extraction = extractTextRuns(node as TextNode);
      if (extraction.requiresRaster) {
        warnings.push({
          nodeId: node.id,
          nodeName: node.name,
          code: 'LETTER_SPACING_LOST',
          message: extraction.rasterReason ?? 'Text cannot be represented — it will be converted to an image.',
          category: 'rasterized',
        });
        return;
      }
      // Reste natif, mais la police manquante a été remplacée par la plus
      // proche disponible dans Slides : glyphes, largeurs et retours à la
      // ligne peuvent différer de l'original — c'est cette différence-là,
      // pas la rasterisation, qui casse le plus souvent la mise en page.
      for (const w of extraction.fontWarnings) {
        if (!w.substitute) continue;
        warnings.push({
          nodeId: node.id,
          nodeName: node.name,
          code: 'FONT_SUBSTITUTED',
          message: `Font "${w.original}" → "${w.substitute}".`,
          category: 'visual-diff',
        });
      }
      return;
    }

    case 'native-shape-round-rectangle':
      if (decision.approximated) {
        warnings.push({
          nodeId: node.id,
          nodeName: node.name,
          code: 'RADIUS_APPROXIMATED',
          message: 'Corner radius is approximated by Slides (fixed, non-adjustable value).',
          category: 'visual-diff',
        });
      }
      return;

    case 'descend': {
      if (decision.background?.action === 'native-shape-round-rectangle' && decision.background.approximated) {
        warnings.push({
          nodeId: node.id,
          nodeName: node.name,
          code: 'RADIUS_APPROXIMATED',
          message: 'Corner radius is approximated by Slides (fixed, non-adjustable value).',
          category: 'visual-diff',
        });
      }
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
