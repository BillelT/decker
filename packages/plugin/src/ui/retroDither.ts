/**
 * Quantification "16 couleurs VGA + tramage ordonné" — le rendu d'une image
 * sur un PC Windows 95 en 640×480.
 *
 * Utilisé par l'aperçu d'export (RetroExportPreview) pour la passe grossière
 * du chargement bande par bande : les premières bandes apparaissent tramées
 * façon 90s, la passe finale les remplace par l'image en vraies couleurs.
 *
 * Fonction pure (travaille sur un `Uint8ClampedArray` façon
 * `ImageData.data`) : testable sans DOM.
 */

/** Palette 16 couleurs EGA/VGA, celle des icônes et fonds d'écran de Windows 95. */
export const VGA_PALETTE: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [128, 0, 0],
  [0, 128, 0],
  [128, 128, 0],
  [0, 0, 128],
  [128, 0, 128],
  [0, 128, 128],
  [192, 192, 192],
  [128, 128, 128],
  [255, 0, 0],
  [0, 255, 0],
  [255, 255, 0],
  [0, 0, 255],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 255],
];

/** Matrice de Bayer 4×4 (tramage ordonné), valeurs 0–15. */
const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Amplitude par défaut du bruit de tramage, en niveaux 0–255. */
const DEFAULT_STRENGTH = 56;

function nearestPaletteIndex(r: number, g: number, b: number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < VGA_PALETTE.length; i++) {
    const [pr, pg, pb] = VGA_PALETTE[i];
    const distance = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/**
 * Réduit les pixels à la palette VGA, en place, avec tramage ordonné de
 * Bayer : le seuil ajouté avant quantification dépend de la position du
 * pixel, ce qui casse les aplats en damier plutôt qu'en bandes de postérisation.
 * `strength` à 0 donne une quantification sèche, sans tramage.
 */
export function ditherToVgaPalette(pixels: Uint8ClampedArray, width: number, strength = DEFAULT_STRENGTH): void {
  for (let i = 0; i < pixels.length; i += 4) {
    const pixelIndex = i / 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const bias = (BAYER_4[y % 4][x % 4] / 16 - 0.5) * strength;
    const [r, g, b] = VGA_PALETTE[nearestPaletteIndex(pixels[i] + bias, pixels[i + 1] + bias, pixels[i + 2] + bias)];
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
  }
}
