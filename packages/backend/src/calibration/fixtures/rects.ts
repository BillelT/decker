import { PNG } from 'pngjs';
import type { IRDocument, IRShape } from '@figma-to-slides/shared';

/**
 * Fixture `01-rects` (spec §9) : 5 rectangles unis aux 4 coins + au centre.
 * Générée en code plutôt qu'exportée d'un fichier Figma réel — cette
 * fixture ne teste QUE la chaîne coordonnées/échelle/z-order (spec §4,
 * critère de sortie de Phase 0), pas l'extraction Figma elle-même.
 * Un vrai fichier Figma de test (spec §9, tableau complet) reste à créer
 * pour calibrer `textInset` et les autres constantes de `calibration.json`.
 */
const FRAME = { width: 720, height: 405 };
const RECT = { w: 100, h: 60 };
const MARGIN = 20;

const COLORS: Record<string, { r: number; g: number; b: number }> = {
  'top-left': { r: 0.9, g: 0.2, b: 0.2 },
  'top-right': { r: 0.2, g: 0.7, b: 0.3 },
  'bottom-left': { r: 0.2, g: 0.4, b: 0.9 },
  'bottom-right': { r: 0.9, g: 0.7, b: 0.1 },
  center: { r: 0.5, g: 0.2, b: 0.7 },
};

function rectPositions(): Record<keyof typeof COLORS, { x: number; y: number }> {
  return {
    'top-left': { x: MARGIN, y: MARGIN },
    'top-right': { x: FRAME.width - MARGIN - RECT.w, y: MARGIN },
    'bottom-left': { x: MARGIN, y: FRAME.height - MARGIN - RECT.h },
    'bottom-right': { x: FRAME.width - MARGIN - RECT.w, y: FRAME.height - MARGIN - RECT.h },
    center: { x: (FRAME.width - RECT.w) / 2, y: (FRAME.height - RECT.h) / 2 },
  } as Record<keyof typeof COLORS, { x: number; y: number }>;
}

export function buildRectsFixtureDocument(): IRDocument {
  const positions = rectPositions();
  const elements: IRShape[] = Object.entries(positions).map(([name, pos]) => ({
    kind: 'shape',
    id: `f2s_calib_${name}`,
    sourceNodeId: name,
    rect: { x: pos.x, y: pos.y, w: RECT.w, h: RECT.h },
    rotation: 0,
    opacity: 1,
    shapeType: 'RECTANGLE',
    fill: { type: 'SOLID', color: { ...COLORS[name], a: 1 } },
  }));

  return {
    version: 1,
    presentationTitle: 'f2s-calibration-01-rects',
    slideSize: { widthPt: FRAME.width, heightPt: FRAME.height },
    slides: [
      {
        sourceNodeId: '01-rects',
        frameName: '01-rects',
        order: 0,
        frameSize: FRAME,
        elements,
        warnings: [],
        previewDataUrl: '',
      },
    ],
    options: {
      mode: 'new-presentation',
      rasterScale: 2,
      includeUnderlay: false,
      underlayOpacity: 0.3,
      strictMode: false,
    },
  };
}

/** Rendu de référence : les 5 rectangles peints directement en pixels. */
export function renderRectsReferencePng(scalePxPerPt = 2): Buffer {
  const width = FRAME.width * scalePxPerPt;
  const height = FRAME.height * scalePxPerPt;
  const png = new PNG({ width, height });
  png.data.fill(255); // fond blanc

  const positions = rectPositions();
  for (const [name, pos] of Object.entries(positions)) {
    const color = COLORS[name];
    fillRect(
      png,
      Math.round(pos.x * scalePxPerPt),
      Math.round(pos.y * scalePxPerPt),
      Math.round(RECT.w * scalePxPerPt),
      Math.round(RECT.h * scalePxPerPt),
      Math.round(color.r * 255),
      Math.round(color.g * 255),
      Math.round(color.b * 255),
    );
  }
  return PNG.sync.write(png);
}

function fillRect(png: PNG, x0: number, y0: number, w: number, h: number, r: number, g: number, b: number): void {
  for (let y = y0; y < y0 + h && y < png.height; y++) {
    for (let x = x0; x < x0 + w && x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
}
