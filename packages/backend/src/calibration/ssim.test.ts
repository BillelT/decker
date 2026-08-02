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
});
