import { describe, expect, it } from 'vitest';
import {
  SLIDE_16_9,
  applyTextInset,
  computeScale,
  identityTransform,
  rotatedTransform,
  roundForSerialization,
} from './transform.js';
import type { AffineTransform } from './slidesRequests.js';

/** newX/newY per the Slides AffineTransform convention (spec §3.2). */
function applyAffine(t: AffineTransform, x: number, y: number) {
  return {
    x: t.scaleX * x + t.shearX * y + t.translateX,
    y: t.shearY * x + t.scaleY * y + t.translateY,
  };
}

describe('computeScale', () => {
  it('fits a wider-than-slide frame by width and centers vertically', () => {
    const { scale, offsetXPt, offsetYPt } = computeScale({ width: 1440, height: 810 }, SLIDE_16_9);
    expect(scale).toBeCloseTo(720 / 1440);
    expect(offsetXPt).toBeCloseTo(0);
    expect(offsetYPt).toBeCloseTo(0);
  });

  it('centers a square frame inside a 16:9 slide', () => {
    const { scale, offsetXPt, offsetYPt } = computeScale({ width: 1000, height: 1000 }, SLIDE_16_9);
    expect(scale).toBeCloseTo(405 / 1000);
    expect(offsetXPt).toBeGreaterThan(0);
    expect(offsetYPt).toBeCloseTo(0);
  });
});

describe('roundForSerialization', () => {
  it('rounds to exactly 3 decimals only at the final step (spec §3.1)', () => {
    expect(roundForSerialization(1.23456789)).toBe(1.235);
    expect(roundForSerialization(10)).toBe(10);
  });
});

describe('identityTransform', () => {
  it('produces scale=1 and translate = top-left corner', () => {
    expect(identityTransform(12.5, 7)).toEqual({
      scaleX: 1,
      scaleY: 1,
      shearX: 0,
      shearY: 0,
      translateX: 12.5,
      translateY: 7,
      unit: 'PT',
    });
  });
});

describe('rotatedTransform', () => {
  it('degenerates to identityTransform at 0 degrees', () => {
    expect(rotatedTransform(10, 20, 100, 50, 0)).toEqual(identityTransform(10, 20));
  });

  it.each([15, 45, 90, -30, 180])('keeps the rectangle center fixed at %s degrees', (deg) => {
    const x = 10;
    const y = 20;
    const w = 100;
    const h = 40;
    const t = rotatedTransform(x, y, w, h, deg);
    const center = applyAffine(t, w / 2, h / 2);
    // translateX/Y are rounded to 3 decimals at serialization (spec §3.1),
    // so allow for that rounding rather than exact floating equality.
    expect(center.x).toBeCloseTo(x + w / 2, 2);
    expect(center.y).toBeCloseTo(y + h / 2, 2);
  });

  it('swaps the rotated bounding-box footprint at 90 degrees CCW, center preserved', () => {
    const x = 0;
    const y = 0;
    const w = 100;
    const h = 40;
    const t = rotatedTransform(x, y, w, h, 90);
    const corners = [
      applyAffine(t, 0, 0),
      applyAffine(t, w, 0),
      applyAffine(t, w, h),
      applyAffine(t, 0, h),
    ];
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    const boundingWidth = Math.max(...xs) - Math.min(...xs);
    const boundingHeight = Math.max(...ys) - Math.min(...ys);

    // A 90° turn swaps the footprint: bounding width becomes the original
    // height and vice-versa.
    expect(boundingWidth).toBeCloseTo(h, 2);
    expect(boundingHeight).toBeCloseTo(w, 2);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(x + w / 2, 2);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(y + h / 2, 2);
  });

  describe('flipped (Figma "Flip Horizontal"/"Flip Vertical")', () => {
    // Bug reproduced on the "how it works" demo's mountain motif: a
    // triangle flipped horizontally in Figma (which Figma reports as
    // rotation=180°, since a single angle can't express a mirror) came out
    // rotated 180° in Slides — visually a DOUBLE flip (both axes), not the
    // single horizontal flip the artist actually made.

    it('at 180°, produces a pure horizontal mirror — not a 180° rotation', () => {
      const t = rotatedTransform(0, 0, 100, 40, 180, true);
      expect(t.scaleX).toBeCloseTo(-1, 5);
      expect(t.scaleY).toBeCloseTo(1, 5);
      expect(t.shearX).toBeCloseTo(0, 5);
      expect(t.shearY).toBeCloseTo(0, 5);
    });

    it('at 0°, produces a pure vertical mirror', () => {
      const t = rotatedTransform(0, 0, 100, 40, 0, true);
      expect(t.scaleX).toBeCloseTo(1, 5);
      expect(t.scaleY).toBeCloseTo(-1, 5);
      expect(t.shearX).toBeCloseTo(0, 5);
      expect(t.shearY).toBeCloseTo(0, 5);
    });

    it('at 180°, swaps left/right edge midpoints (a real mirror, not a same-point rotation)', () => {
      const x = 10;
      const y = 20;
      const w = 100;
      const h = 40;
      const t = rotatedTransform(x, y, w, h, 180, true);
      const leftMid = applyAffine(t, 0, h / 2);
      const rightMid = applyAffine(t, w, h / 2);
      // A horizontal mirror sends the local left-edge midpoint to the
      // absolute RIGHT edge, and vice-versa — top edge stays on top.
      expect(leftMid.x).toBeCloseTo(x + w, 2);
      expect(leftMid.y).toBeCloseTo(y + h / 2, 2);
      expect(rightMid.x).toBeCloseTo(x, 2);
      expect(rightMid.y).toBeCloseTo(y + h / 2, 2);
    });

    it.each([15, 45, 90, -30, 180])('keeps the rectangle center fixed at %s degrees even when flipped', (deg) => {
      const x = 10;
      const y = 20;
      const w = 100;
      const h = 40;
      const t = rotatedTransform(x, y, w, h, deg, true);
      const center = applyAffine(t, w / 2, h / 2);
      expect(center.x).toBeCloseTo(x + w / 2, 2);
      expect(center.y).toBeCloseTo(y + h / 2, 2);
    });

    it('leaves the non-flipped transform at the same angle untouched (regression safety)', () => {
      const withoutFlipArg = rotatedTransform(10, 20, 100, 40, 37);
      const explicitlyNotFlipped = rotatedTransform(10, 20, 100, 40, 37, false);
      expect(withoutFlipArg).toEqual(explicitlyNotFlipped);
    });
  });
});

describe('applyTextInset', () => {
  it('expands the box outward by the calibrated inset (spec §3.5)', () => {
    const rect = { x: 10, y: 10, w: 100, h: 50 };
    const inset = { left: 2, right: 3, top: 1, bottom: 4 };
    expect(applyTextInset(rect, inset)).toEqual({ x: 8, y: 9, w: 105, h: 55 });
  });
});
