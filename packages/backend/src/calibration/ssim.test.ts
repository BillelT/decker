import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { compareSsim } from './ssim.js';
import { renderRectsReferencePng } from './fixtures/rects.js';

describe('compareSsim', () => {
  it('scores 1.0 (or extremely close) comparing an image against itself', () => {
    const png = renderRectsReferencePng(1);
    const { score } = compareSsim(png, png);
    expect(score).toBeGreaterThan(0.999);
  });

  it('scores meaningfully lower against a blank white image of the same size', () => {
    const rects = renderRectsReferencePng(1);
    const { width, height } = PNG.sync.read(rects);
    const blank = new PNG({ width, height });
    blank.data.fill(255);

    const { score } = compareSsim(rects, PNG.sync.write(blank));
    expect(score).toBeLessThan(0.95);
  });

  // Régression (audit 2026-08) : la miniature réelle renvoyée par l'API
  // Slides n'a pas forcément la même résolution que l'image de référence
  // (voir commentaire d'alignImages) — même contenu, échelle différente, ne
  // doit pas être pénalisé par un simple rognage au plus petit dénominateur.
  it('scores highly comparing the same content rendered at a different resolution', () => {
    const small = renderRectsReferencePng(1); // 720x405
    const large = renderRectsReferencePng(2); // 1440x810 — mêmes proportions, contenu identique

    const { score } = compareSsim(small, large);
    expect(score).toBeGreaterThan(0.99);
  });
});
