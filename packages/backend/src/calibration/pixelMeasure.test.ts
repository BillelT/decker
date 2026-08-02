import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { firstColWithColor, firstRowWithColor, pixelAt } from './pixelMeasure.js';

function makePng(width: number, height: number, bg: { r: number; g: number; b: number }): PNG {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    png.data[i * 4] = bg.r;
    png.data[i * 4 + 1] = bg.g;
    png.data[i * 4 + 2] = bg.b;
    png.data[i * 4 + 3] = 255;
  }
  return png;
}

function paintRect(png: PNG, x0: number, y0: number, w: number, h: number, color: { r: number; g: number; b: number }): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const idx = (png.width * y + x) << 2;
      png.data[idx] = color.r;
      png.data[idx + 1] = color.g;
      png.data[idx + 2] = color.b;
    }
  }
}

const RED = { r: 255, g: 0, b: 0 };
const GRAY = { r: 200, g: 200, b: 200 };

describe('pixelMeasure', () => {
  it('pixelAt reads back the color painted at a coordinate', () => {
    const img = makePng(20, 20, GRAY);
    paintRect(img, 5, 5, 1, 1, RED);
    expect(pixelAt(img, 5, 5)).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('firstRowWithColor finds the first row (top-down) containing the target color', () => {
    const img = makePng(50, 50, GRAY);
    paintRect(img, 10, 20, 30, 10, RED); // rows 20..29 are red within x 10..39
    const row = firstRowWithColor(img, 0, 49, 10, 39, RED, 10);
    expect(row).toBe(20);
  });

  it('firstRowWithColor scans bottom-up when from > to', () => {
    const img = makePng(50, 50, GRAY);
    paintRect(img, 10, 20, 30, 10, RED); // last red row is 29
    const row = firstRowWithColor(img, 49, 0, 10, 39, RED, 10);
    expect(row).toBe(29);
  });

  it('firstColWithColor finds the first column (left-to-right) containing the target color', () => {
    const img = makePng(50, 50, GRAY);
    paintRect(img, 15, 5, 5, 40, RED); // cols 15..19 are red within y 5..44
    const col = firstColWithColor(img, 0, 49, 5, 44, RED, 10);
    expect(col).toBe(15);
  });

  it('returns undefined when the target color never appears', () => {
    const img = makePng(20, 20, GRAY);
    expect(firstRowWithColor(img, 0, 19, 0, 19, RED, 10)).toBeUndefined();
  });
});
