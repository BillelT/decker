import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { fillEllipse, fillPolygon, fillRect, fillRoundedRect, strokeRect } from './rasterPrimitives.js';

const RED = { r: 1, g: 0, b: 0 };

function pixel(png: PNG, x: number, y: number): [number, number, number, number] {
  const idx = (png.width * y + x) << 2;
  return [png.data[idx], png.data[idx + 1], png.data[idx + 2], png.data[idx + 3]];
}

function blank(size = 40): PNG {
  const png = new PNG({ width: size, height: size });
  png.data.fill(255);
  return png;
}

describe('rasterPrimitives', () => {
  it('fillRect paints exactly the requested rectangle', () => {
    const png = blank();
    fillRect(png, 10, 10, 5, 5, RED);
    expect(pixel(png, 12, 12)).toEqual([255, 0, 0, 255]);
    expect(pixel(png, 20, 20)).toEqual([255, 255, 255, 255]);
  });

  it('fillEllipse paints the center but not the far corners of its bounding box', () => {
    const png = blank();
    fillEllipse(png, 0, 0, 40, 40, RED);
    expect(pixel(png, 20, 20)).toEqual([255, 0, 0, 255]);
    expect(pixel(png, 0, 0)).toEqual([255, 255, 255, 255]); // coin hors de l'ellipse inscrite
  });

  it('strokeRect paints a ring, leaving the interior untouched', () => {
    const png = blank();
    strokeRect(png, 10, 10, 20, 20, 4, RED);
    expect(pixel(png, 10, 20)).toEqual([255, 0, 0, 255]); // sur le bord
    expect(pixel(png, 20, 20)).toEqual([255, 255, 255, 255]); // au centre, non peint
  });

  it('fillRoundedRect leaves the extreme corner pixel unpainted for a non-trivial radius', () => {
    const png = blank();
    fillRoundedRect(png, 5, 5, 30, 30, 8, RED);
    expect(pixel(png, 5, 5)).toEqual([255, 255, 255, 255]); // coin exclu par l'arrondi
    expect(pixel(png, 20, 20)).toEqual([255, 0, 0, 255]); // centre, plein
  });

  it('fillPolygon paints a simple triangle', () => {
    const png = blank();
    fillPolygon(
      png,
      [
        [5, 30],
        [20, 5],
        [35, 30],
      ],
      RED,
    );
    expect(pixel(png, 20, 20)).toEqual([255, 0, 0, 255]); // à l'intérieur du triangle
    expect(pixel(png, 2, 2)).toEqual([255, 255, 255, 255]); // en dehors
  });
});
