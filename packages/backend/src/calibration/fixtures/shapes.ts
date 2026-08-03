import { PNG } from 'pngjs';
import type { IRDocument, IRShape } from '@figma-to-slides/shared';
import { UNCALIBRATED_DEFAULTS } from '@figma-to-slides/shared';
import { fillEllipse, fillRect, fillRoundedRect, strokeRect, type RgbColor } from './rasterPrimitives.js';

/**
 * Fixture `06-shapes` (spec §9 : « mapping des presets + règle radius »).
 * Comme `01-rects`/`02-rotation`, générée en code — `shapeType`/`fill`/
 * `stroke` sont des champs du contrat IR déjà résolus (spec §6), pas une
 * décision d'extraction Figma : le mapper (`mapShape`) n'a besoin que d'un
 * `IRShape` valide, peu importe sa provenance.
 *
 * Volontairement limitée à ELLIPSE, RECTANGLE+stroke et ROUND_RECTANGLE —
 * PENTAGON/STAR_5 etc. ont une géométrie de preset propre à Slides (marges
 * internes, proportions) non documentée : une référence approximative y
 * produirait un écart qui ressemblerait à un bug sans en être un. Le rayon
 * de ROUND_RECTANGLE est lui-même une approximation (`UNCALIBRATED_DEFAULTS
 * .roundRectRadiusRatio`, jamais mesuré — voir LIMITATIONS.md), attendre un
 * score parfait sur ce seul élément n'aurait pas de sens.
 */
const FRAME = { width: 720, height: 405 };
const SHAPE = { w: 180, h: 160 };
const Y = 122;

const ELLIPSE_COLOR: RgbColor = { r: 0.2, g: 0.6, b: 0.35 };
const RECT_FILL_COLOR: RgbColor = { r: 0.97, g: 0.97, b: 0.95 };
const RECT_STROKE_COLOR: RgbColor = { r: 0.1, g: 0.15, b: 0.4 };
const RECT_STROKE_WEIGHT_PT = 4;
const ROUND_RECT_COLOR: RgbColor = { r: 0.9, g: 0.55, b: 0.15 };

const ELLIPSE_X = 40;
const RECT_X = 270;
const ROUND_RECT_X = 500;

export function buildShapesFixtureDocument(): IRDocument {
  const elements: IRShape[] = [
    {
      kind: 'shape',
      id: 'f2s_calib_shape_ellipse',
      sourceNodeId: 'ellipse',
      rect: { x: ELLIPSE_X, y: Y, w: SHAPE.w, h: SHAPE.h },
      rotation: 0,
      opacity: 1,
      shapeType: 'ELLIPSE',
      fill: { type: 'SOLID', color: { ...ELLIPSE_COLOR, a: 1 } },
    },
    {
      kind: 'shape',
      id: 'f2s_calib_shape_rect_stroke',
      sourceNodeId: 'rect-stroke',
      rect: { x: RECT_X, y: Y, w: SHAPE.w, h: SHAPE.h },
      rotation: 0,
      opacity: 1,
      shapeType: 'RECTANGLE',
      fill: { type: 'SOLID', color: { ...RECT_FILL_COLOR, a: 1 } },
      stroke: { color: { ...RECT_STROKE_COLOR, a: 1 }, weightPt: RECT_STROKE_WEIGHT_PT, dash: 'SOLID' },
    },
    {
      kind: 'shape',
      id: 'f2s_calib_shape_round_rect',
      sourceNodeId: 'round-rect',
      rect: { x: ROUND_RECT_X, y: Y, w: SHAPE.w, h: SHAPE.h },
      rotation: 0,
      opacity: 1,
      shapeType: 'ROUND_RECTANGLE',
      fill: { type: 'SOLID', color: { ...ROUND_RECT_COLOR, a: 1 } },
    },
  ];

  return {
    version: 1,
    presentationTitle: 'f2s-calibration-06-shapes',
    slideSize: { widthPt: FRAME.width, heightPt: FRAME.height },
    slides: [
      { sourceNodeId: '06-shapes', frameName: '06-shapes', order: 0, frameSize: FRAME, elements, warnings: [], previewDataUrl: '' },
    ],
    options: { mode: 'new-presentation', rasterScale: 2, includeUnderlay: false, underlayOpacity: 0.3, strictMode: false },
  };
}

export function renderShapesReferencePng(scalePxPerPt = 2): Buffer {
  const width = FRAME.width * scalePxPerPt;
  const height = FRAME.height * scalePxPerPt;
  const png = new PNG({ width, height });
  png.data.fill(255);

  const s = scalePxPerPt;
  fillEllipse(png, ELLIPSE_X * s, Y * s, SHAPE.w * s, SHAPE.h * s, ELLIPSE_COLOR);

  fillRect(png, RECT_X * s, Y * s, SHAPE.w * s, SHAPE.h * s, RECT_FILL_COLOR);
  strokeRect(png, RECT_X * s, Y * s, SHAPE.w * s, SHAPE.h * s, RECT_STROKE_WEIGHT_PT * s, RECT_STROKE_COLOR);

  const radius = UNCALIBRATED_DEFAULTS.roundRectRadiusRatio * Math.min(SHAPE.w, SHAPE.h) * s;
  fillRoundedRect(png, ROUND_RECT_X * s, Y * s, SHAPE.w * s, SHAPE.h * s, radius, ROUND_RECT_COLOR);

  return PNG.sync.write(png);
}
