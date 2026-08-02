import type { PNG } from 'pngjs';

/**
 * Petit outillage de lecture de pixels pour les fixtures de calibration qui
 * mesurent une distance visuelle réelle (marge interne d'une text box, rayon
 * d'un coin arrondi…) plutôt que de comparer deux images entières (SSIM,
 * voir ssim.ts). Générique, sans dépendance au contenu d'une fixture donnée.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function pixelAt(img: PNG, x: number, y: number): Rgb {
  const px = Math.min(img.width - 1, Math.max(0, Math.round(x)));
  const py = Math.min(img.height - 1, Math.max(0, Math.round(y)));
  const idx = (img.width * py + px) << 2;
  return { r: img.data[idx], g: img.data[idx + 1], b: img.data[idx + 2] };
}

function colorDistance(a: Rgb, b: Rgb): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function rowHasColor(img: PNG, y: number, xStart: number, xEnd: number, target: Rgb, tolerance: number): boolean {
  for (let x = xStart; x <= xEnd; x++) {
    if (colorDistance(pixelAt(img, x, y), target) <= tolerance) return true;
  }
  return false;
}

function colHasColor(img: PNG, x: number, yStart: number, yEnd: number, target: Rgb, tolerance: number): boolean {
  for (let y = yStart; y <= yEnd; y++) {
    if (colorDistance(pixelAt(img, x, y), target) <= tolerance) return true;
  }
  return false;
}

/**
 * Première ligne rencontrée en parcourant de `from` vers `to` (inclus, dans
 * n'importe quel sens) où `target` apparaît dans la plage de colonnes
 * [xStart, xEnd] — `undefined` si jamais trouvée sur tout le trajet.
 */
export function firstRowWithColor(
  img: PNG,
  from: number,
  to: number,
  xStart: number,
  xEnd: number,
  target: Rgb,
  tolerance: number,
): number | undefined {
  const step = to >= from ? 1 : -1;
  for (let y = from; step > 0 ? y <= to : y >= to; y += step) {
    if (rowHasColor(img, y, xStart, xEnd, target, tolerance)) return y;
  }
  return undefined;
}

/** Symétrique de `firstRowWithColor`, par colonne plutôt que par ligne. */
export function firstColWithColor(
  img: PNG,
  from: number,
  to: number,
  yStart: number,
  yEnd: number,
  target: Rgb,
  tolerance: number,
): number | undefined {
  const step = to >= from ? 1 : -1;
  for (let x = from; step > 0 ? x <= to : x >= to; x += step) {
    if (colHasColor(img, x, yStart, yEnd, target, tolerance)) return x;
  }
  return undefined;
}
