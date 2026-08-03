import { PNG } from 'pngjs';
import type { IRDocument, IRShape } from '@figma-to-slides/shared';
import { rotatedTransform } from '../../mapper/transform.js';
import { fillPolygon, type RgbColor } from './rasterPrimitives.js';

/**
 * Fixture `02-rotation` (spec §9 : « transform affine »). Comme `01-rects`,
 * générée en code plutôt qu'exportée d'un fichier Figma réel — la rotation
 * est une propriété purement géométrique du contrat IR (`IRBase.rotation`,
 * consommée par `mapper/transform.ts::rotatedTransform`), pas une décision
 * d'extraction Figma : rien à gagner à passer par un vrai fichier ici, tout
 * comme pour `01-rects`.
 *
 * L'image de référence réutilise `rotatedTransform` (la MÊME fonction que
 * le mapper) pour calculer les 4 coins réels de chaque rectangle tourné,
 * plutôt que de réimplémenter la trigonométrie de rotation à côté et
 * risquer une convention CW/CCW différente — la référence est ainsi
 * garantie cohérente avec ce que l'API reçoit réellement.
 */
const FRAME = { width: 720, height: 405 };
const RECT = { w: 100, h: 60 };
const ROTATIONS_DEG = [0, 15, 45, 90, -30];
const SPACING_X = 140;
const START_CENTER_X = 90;
const CENTER_Y = 202.5;

const COLORS: RgbColor[] = [
  { r: 0.9, g: 0.2, b: 0.2 },
  { r: 0.2, g: 0.7, b: 0.3 },
  { r: 0.2, g: 0.4, b: 0.9 },
  { r: 0.9, g: 0.7, b: 0.1 },
  { r: 0.5, g: 0.2, b: 0.7 },
];

function topLeftPositions(): { x: number; y: number }[] {
  return ROTATIONS_DEG.map((_, i) => ({
    x: START_CENTER_X + i * SPACING_X - RECT.w / 2,
    y: CENTER_Y - RECT.h / 2,
  }));
}

export function buildRotationFixtureDocument(): IRDocument {
  const positions = topLeftPositions();
  const elements: IRShape[] = ROTATIONS_DEG.map((rotation, i) => ({
    kind: 'shape',
    id: `f2s_calib_rot_${i}`,
    sourceNodeId: `rot-${i}`,
    rect: { x: positions[i].x, y: positions[i].y, w: RECT.w, h: RECT.h },
    rotation,
    opacity: 1,
    shapeType: 'RECTANGLE',
    fill: { type: 'SOLID', color: { ...COLORS[i], a: 1 } },
  }));

  return {
    version: 1,
    presentationTitle: 'f2s-calibration-02-rotation',
    slideSize: { widthPt: FRAME.width, heightPt: FRAME.height },
    slides: [
      {
        sourceNodeId: '02-rotation',
        frameName: '02-rotation',
        order: 0,
        frameSize: FRAME,
        elements,
        warnings: [],
        previewDataUrl: '',
      },
    ],
    options: { mode: 'new-presentation', rasterScale: 2, includeUnderlay: false, underlayOpacity: 0.3, strictMode: false },
  };
}

/** Coins réels (page pt, ou px si `scalePxPerPt` est appliqué en amont) d'un rectangle w×h tourné, via la transform du mapper. */
function rotatedCorners(xPt: number, yPt: number, wPt: number, hPt: number, degCCW: number): [number, number][] {
  const t = rotatedTransform(xPt, yPt, wPt, hPt, degCCW);
  const local: [number, number][] = [
    [0, 0],
    [wPt, 0],
    [wPt, hPt],
    [0, hPt],
  ];
  return local.map(([u, v]) => [t.scaleX * u + t.shearX * v + t.translateX, t.shearY * u + t.scaleY * v + t.translateY]);
}

export function renderRotationReferencePng(scalePxPerPt = 2): Buffer {
  const width = FRAME.width * scalePxPerPt;
  const height = FRAME.height * scalePxPerPt;
  const png = new PNG({ width, height });
  png.data.fill(255);

  const positions = topLeftPositions();
  ROTATIONS_DEG.forEach((rotation, i) => {
    const corners = rotatedCorners(
      positions[i].x * scalePxPerPt,
      positions[i].y * scalePxPerPt,
      RECT.w * scalePxPerPt,
      RECT.h * scalePxPerPt,
      rotation,
    );
    fillPolygon(png, corners, COLORS[i]);
  });
  return PNG.sync.write(png);
}
