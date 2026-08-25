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
    /** Nombre de côtés d'un POLYGON régulier (Figma `PolygonNode.pointCount`) — absent pour les autres kinds. */
    polygonSides?: number;
    /** Nombre de branches d'un STAR (Figma `StarNode.pointCount`) — absent pour les autres kinds. */
    starPoints?: number;
  };
  line?: {
    visibleStrokeCount: number;
    strokeIsGradient: boolean;
    strokeWeightIsMixed: boolean;
    hasUnsupportedCap: boolean;
  };
  container?: {
    clipsContentWithOverflow: boolean;
    /**
     * Fond propre du conteneur (FRAME/COMPONENT/INSTANCE — un GROUP n'a pas
     * de `fills`, `undefined` dans ce cas) — même forme que `shape` ci-dessus,
     * pour réutiliser exactement la même logique de décision fill/contour/
     * rayon qu'un vrai RECTANGLE (audit 2026-08 : avant ça, le fond d'un
     * conteneur imbriqué — pas la slide racine — disparaissait toujours,
     * silencieusement, dès que ce conteneur restait natif).
     */
    fill?: {
      visibleFillCount: number;
      fillIsGradient: boolean;
      fillIsImage: boolean;
      hasMultipleOrOffCenterStroke: boolean;
      radiusDecision?: RadiusDecision;
    };
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
  | 'POLYGON_SIDES_UNSUPPORTED'
  | 'STAR_POINTS_UNSUPPORTED'
  | 'LINE_RASTERIZED'
  | 'LETTER_SPACING_LOST'
  | 'RADIUS_APPROXIMATED'
  | 'CORNER_RADIUS_RASTERIZED'
  | 'MULTIPLE_FILLS_RASTERIZED'
  | 'CONTAINER_BACKGROUND_RASTERIZED';

export type Decision =
  | { action: 'ignore' }
  | { action: 'raster'; warningCode: WarningCode; message: string }
  | { action: 'native-text' }
  | { action: 'native-shape-preset' }
  | { action: 'native-shape-ellipse' }
  | { action: 'native-shape-round-rectangle'; approximated: boolean }
  | { action: 'native-line' }
  | { action: 'image' }
  | {
      action: 'descend';
      /** Fond du conteneur à créer AVANT de descendre dans ses enfants (z-order arrière → avant) — absent si le conteneur n'a aucun fill visible. */
      background?: { action: 'native-shape-preset' | 'native-shape-ellipse' | 'native-shape-round-rectangle'; approximated?: boolean };
    };

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
    // Slides n'a de préréglage natif que pour 3/4/5/6 côtés (TRIANGLE,
    // DIAMOND, PENTAGON, HEXAGON) — au-delà, forcer un de ces préréglages
    // dessinerait une forme visiblement différente (constaté : un heptagone
    // ou plus rendait un gros hexagone mal centré). Rastériser reste fidèle.
    if (input.kind === 'POLYGON' && s?.polygonSides !== undefined && ![3, 4, 5, 6].includes(s.polygonSides)) {
      return {
        action: 'raster',
        warningCode: 'POLYGON_SIDES_UNSUPPORTED',
        message: `Slides has no native preset for a ${s.polygonSides}-sided polygon (only 3–6) — converted to an image.`,
      };
    }
    // Même logique que POLYGON ci-dessus, mais pour STAR : seul le préréglage
    // Slides STAR_5 est calibré/vérifié dans ce projet (voir
    // calibration/fixtures/shapes.ts) — un autre nombre de branches est
    // rastérisé plutôt que de deviner un nom d'enum Slides non vérifié.
    if (input.kind === 'STAR' && s?.starPoints !== undefined && s.starPoints !== 5) {
      return {
        action: 'raster',
        warningCode: 'STAR_POINTS_UNSUPPORTED',
        message: `Slides has no verified native preset for a ${s.starPoints}-point star (only 5) — converted to an image.`,
      };
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
    const bg = input.container?.fill;
    if (bg && bg.visibleFillCount > 0) {
      // Un conteneur imbriqué (pas la slide racine) a aussi une boîte visible
      // propre — sans ce bloc, elle disparaissait toujours silencieusement,
      // seuls ses enfants étaient exportés (audit 2026-08). Une seule
      // solution FIABLE quand le fond ne peut pas être représenté nativement
      // (dégradé, image, fills multiples, contour non standard) : rastériser
      // TOUT le sous-arbre (fond + enfants), comme pour un masque/ombre plus
      // haut — un raster "juste le fond" nécessiterait de cacher
      // temporairement les enfants avant `exportAsync`, bien plus invasif
      // pour un document ouvert par l'utilisateur.
      if (bg.visibleFillCount > 1 || bg.fillIsGradient || bg.fillIsImage || bg.hasMultipleOrOffCenterStroke) {
        return {
          action: 'raster',
          warningCode: 'CONTAINER_BACKGROUND_RASTERIZED',
          message: "This layout frame's own background (gradient, image fill, multiple fills, or non-standard stroke) can't be combined natively with its children — the whole group is converted to an image.",
        };
      }
      if (bg.radiusDecision) {
        const rd = bg.radiusDecision;
        if (rd.kind === 'raster') {
          return { action: 'raster', warningCode: 'CORNER_RADIUS_RASTERIZED', message: rd.reason };
        }
        if (rd.kind === 'ellipse') return { action: 'descend', background: { action: 'native-shape-ellipse' } };
        if (rd.kind === 'round-rectangle') {
          return { action: 'descend', background: { action: 'native-shape-round-rectangle', approximated: rd.approximated } };
        }
      }
      return { action: 'descend', background: { action: 'native-shape-preset' } };
    }
    return { action: 'descend' };
  }

  return { action: 'ignore' };
}
