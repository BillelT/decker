import { describe, expect, it } from 'vitest';
import { decideRadius } from './radius.js';

describe('decideRadius', () => {
  it('returns rectangle when all corners are 0', () => {
    expect(decideRadius({ topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 }, 100, 50)).toEqual({ kind: 'rectangle' });
  });

  it('returns ellipse for a pill/circle on a square', () => {
    const decision = decideRadius({ topLeft: 50, topRight: 50, bottomLeft: 50, bottomRight: 50 }, 100, 100);
    expect(decision).toEqual({ kind: 'ellipse' });
  });

  it('returns round-rectangle (approximated) for a pill on a non-square rect', () => {
    const decision = decideRadius({ topLeft: 25, topRight: 25, bottomLeft: 25, bottomRight: 25 }, 200, 50);
    expect(decision).toEqual({ kind: 'round-rectangle', approximated: true });
  });

  it('returns round-rectangle within the native tolerance band', () => {
    // ratio = 10 / 100 = 0.10, within [0.08, 0.25]
    const decision = decideRadius({ topLeft: 10, topRight: 10, bottomLeft: 10, bottomRight: 10 }, 100, 200);
    expect(decision).toEqual({ kind: 'round-rectangle', approximated: true });
  });

  it('rasters when the ratio is below the tolerance band', () => {
    // ratio = 2 / 100 = 0.02
    const decision = decideRadius({ topLeft: 2, topRight: 2, bottomLeft: 2, bottomRight: 2 }, 100, 200);
    expect(decision.kind).toBe('raster');
  });

  it('rasters when radii are non-uniform', () => {
    const decision = decideRadius({ topLeft: 10, topRight: 20, bottomLeft: 10, bottomRight: 10 }, 100, 100);
    expect(decision.kind).toBe('raster');
  });
});
