import { describe, expect, it } from 'vitest';
import { ditherToVgaPalette, VGA_PALETTE } from './retroDither.js';

/** Bande horizontale de `width` pixels d'une même couleur. */
function strip(width: number, r: number, g: number, b: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = 255;
  }
  return pixels;
}

const isPaletteColor = (r: number, g: number, b: number) =>
  VGA_PALETTE.some(([pr, pg, pb]) => pr === r && pg === g && pb === b);

describe('ditherToVgaPalette', () => {
  it('ne produit que des couleurs de la palette', () => {
    const pixels = strip(16, 173, 91, 37);
    ditherToVgaPalette(pixels, 16);
    for (let i = 0; i < pixels.length; i += 4) {
      expect(isPaletteColor(pixels[i], pixels[i + 1], pixels[i + 2])).toBe(true);
    }
  });

  it('laisse intactes les couleurs déjà dans la palette, sans tramage', () => {
    const pixels = strip(4, 255, 0, 0);
    ditherToVgaPalette(pixels, 4, 0);
    expect([...pixels.slice(0, 4)]).toEqual([255, 0, 0, 255]);
  });

  it('préserve le canal alpha', () => {
    const pixels = strip(4, 200, 200, 200);
    pixels[3] = 64;
    ditherToVgaPalette(pixels, 4);
    expect(pixels[3]).toBe(64);
  });

  // Le tramage doit varier avec la position : un aplat gris intermédiaire
  // (entre #808080 et #c0c0c0) devient un damier, pas un aplat postérisé.
  it('trame un aplat intermédiaire en plusieurs couleurs', () => {
    const pixels = strip(8, 160, 160, 160);
    ditherToVgaPalette(pixels, 8);
    const seen = new Set<string>();
    for (let i = 0; i < pixels.length; i += 4) seen.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    expect(seen.size).toBeGreaterThan(1);
  });
});
