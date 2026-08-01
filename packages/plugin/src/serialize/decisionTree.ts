import type { RadiusDecision } from './radius.js';

/**
 * Spec §3.3 — arbre de décision natif/raster, transcrit tel quel. Opère sur
 * une interface étroite (`DecisionInput`) plutôt que sur les types Figma
 * réels : `code.ts` fait l'adaptation SceneNode → DecisionInput, ce qui
 * rend cette fonction testable sans runtime Figma.
 */

export type NodeKind =
  | 'TEXT'
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'POLYGON'
  | 'STAR'
  | 'LINE'
  | 'VECTOR_LIKE' // VECTOR, BOOLEAN_OPERATION, ou STAR/POLYGON/LINE custom (non régulier)
  | 'GROUP_LIKE' // GROUP, FRAME, COMPONENT, INSTANCE
  | 'OTHER'; // SLICE, CONNECTOR, WIDGET, …

export interface DecisionInput {
  kind: NodeKind;
  visible: boolean;
  opacity: number;
  width: number;
  height: number;
  blendMode: string;
  hasVisibleShadowOrBlur: boolean;
  isMasked: boolean;
  text?: {
    fontUnavailable: boolean;
    letterSpacingExceedsThreshold: boolean;
    hasUnrepresentableMixedStyle: boolean;
  };
  shape?: {
    visibleFillCount: number;
    fillIsGradient: boolean;
    fillIsImage: boolean;
    hasMultipleOrOffCenterStroke: boolean;
    radiusDecision?: RadiusDecision;
  };
  line?: {
    visibleStrokeCount: number;
    strokeIsGradient: boolean;
    strokeWeightIsMixed: boolean;
    hasUnsupportedCap: boolean;
  };
  container?: {
    clipsContentWithOverflow: boolean;
  };
}

export type WarningCode =
  | 'FONT_SUBSTITUTED'
  | 'FONT_MISSING'
  | 'GRADIENT_RASTERIZED'
  | 'EFFECT_RASTERIZED'
  | 'BLEND_MODE_RASTERIZED'
  | 'MASK_RASTERIZED'
  | 'VECTOR_RASTERIZED'
  | 'LINE_RASTERIZED'
  | 'LETTER_SPACING_LOST'
  | 'RADIUS_APPROXIMATED'
  | 'CORNER_RADIUS_RASTERIZED'
  | 'MULTIPLE_FILLS_RASTERIZED';

export type Decision =
  | { action: 'ignore' }
  | { action: 'raster'; warningCode: WarningCode; message: string }
  | { action: 'native-text' }
  | { action: 'native-shape-preset' }
  | { action: 'native-shape-ellipse' }
  | { action: 'native-shape-round-rectangle'; approximated: boolean }
  | { action: 'native-line' }
  | { action: 'image' }
  | { action: 'descend' };

/**
 * `PASS_THROUGH` est la valeur renvoyée par l'API Figma pour la quasi-
 * totalité des calques qui n'ont pas de mode de fusion explicite choisi
 * dans l'UI (ce n'est PAS un mode de fusion "normal" au sens strict, mais
 * il se comporte à l'identique pour le rendu) — seuls les modes vraiment
 * différents (MULTIPLY, SCREEN, DARKEN…) doivent déclencher un raster.
 */
const BLEND_MODES_EQUIVALENT_TO_NORMAL = new Set(['NORMAL', 'PASS_THROUGH']);

export function classifyNode(input: DecisionInput): Decision {
  if (!input.visible) return { action: 'ignore' };
  if (input.opacity === 0) return { action: 'ignore' };
  // Une LINE Figma a par construction une largeur ou une hauteur nulle
  // (le trait vient du stroke, pas d'une dimension de boîte) : n'ignorer
  // que les nœuds réellement dégénérés dans les DEUX axes.
  if (input.width < 0.5 && input.height < 0.5) return { action: 'ignore' };
  if (!BLEND_MODES_EQUIVALENT_TO_NORMAL.has(input.blendMode)) {
    return { action: 'raster', warningCode: 'BLEND_MODE_RASTERIZED', message: `Blend mode "${input.blendMode}" isn't supported by Slides — converted to an image.` };
  }
  if (input.hasVisibleShadowOrBlur) {
    return { action: 'raster', warningCode: 'EFFECT_RASTERIZED', message: 'Drop shadow or blur has no native Slides equivalent — converted to an image.' };
  }
  if (input.isMasked) {
    return { action: 'raster', warningCode: 'MASK_RASTERIZED', message: 'Layer masks have no native Slides equivalent — the masked group is flattened into an image.' };
  }

  if (input.kind === 'LINE') {
    const l = input.line;
    if (!l || l.visibleStrokeCount === 0) return { action: 'ignore' }; // pas de contour visible = ligne invisible
    if (l.visibleStrokeCount > 1) {
      return { action: 'raster', warningCode: 'LINE_RASTERIZED', message: 'Multiple strokes on a line — Slides supports only one, converted to an image.' };
    }
    if (l.strokeIsGradient) {
      return { action: 'raster', warningCode: 'GRADIENT_RASTERIZED', message: 'Gradient stroke on a line is not supported by Slides — converted to an image.' };
    }
    if (l.strokeWeightIsMixed) {
      return { action: 'raster', warningCode: 'LINE_RASTERIZED', message: 'Non-uniform stroke weight on this line — converted to an image.' };
    }
    if (l.hasUnsupportedCap) {
      return { action: 'raster', warningCode: 'LINE_RASTERIZED', message: 'Decorative line cap (arrow, diamond, circle…) has no native Slides equivalent — converted to an image.' };
    }
    return { action: 'native-line' };
  }

  if (input.kind === 'TEXT') {
    const t = input.text;
    if (t?.fontUnavailable) {
      return { action: 'raster', warningCode: 'FONT_MISSING', message: 'Font not found and no substitute available — text converted to an image.' };
    }
    if (t?.letterSpacingExceedsThreshold) {
      return { action: 'raster', warningCode: 'LETTER_SPACING_LOST', message: 'Letter spacing changes the text width by more than 2% — converted to an image.' };
    }
    if (t?.hasUnrepresentableMixedStyle) {
      return { action: 'raster', warningCode: 'EFFECT_RASTERIZED', message: 'Mixed text styling cannot be represented — converted to an image.' };
    }
    return { action: 'native-text' };
  }

  if (input.kind === 'RECTANGLE' || input.kind === 'ELLIPSE' || input.kind === 'POLYGON' || input.kind === 'STAR') {
    const s = input.shape;
    if (s && s.visibleFillCount > 1) {
      return { action: 'raster', warningCode: 'MULTIPLE_FILLS_RASTERIZED', message: 'Multiple visible fills — Slides supports only one, converted to an image.' };
    }
    if (s?.fillIsGradient) {
      return { action: 'raster', warningCode: 'GRADIENT_RASTERIZED', message: 'Gradients are not supported by Slides — converted to an image.' };
    }
    if (s?.fillIsImage) {
      return { action: 'image' };
    }
    if (s?.hasMultipleOrOffCenterStroke) {
      return { action: 'raster', warningCode: 'EFFECT_RASTERIZED', message: 'Multiple or off-center stroke beyond tolerance — converted to an image.' };
    }
    if (input.kind === 'RECTANGLE' && s?.radiusDecision) {
      const rd = s.radiusDecision;
      if (rd.kind === 'raster') {
        return { action: 'raster', warningCode: 'CORNER_RADIUS_RASTERIZED', message: rd.reason };
      }
      if (rd.kind === 'ellipse') return { action: 'native-shape-ellipse' };
      if (rd.kind === 'round-rectangle') {
        return { action: 'native-shape-round-rectangle', approximated: rd.approximated };
      }
    }
    return { action: 'native-shape-preset' };
  }

  if (input.kind === 'VECTOR_LIKE') {
    return { action: 'raster', warningCode: 'VECTOR_RASTERIZED', message: 'Custom vector shape (icon, boolean operation, path) — converted to an image.' };
  }

  if (input.kind === 'GROUP_LIKE') {
    if (input.container?.clipsContentWithOverflow) {
      return { action: 'raster', warningCode: 'EFFECT_RASTERIZED', message: 'Group clips overflowing children — flattened into an image.' };
    }
    return { action: 'descend' };
  }

  return { action: 'ignore' };
}
