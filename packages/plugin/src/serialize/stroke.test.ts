import { describe, expect, it } from 'vitest';
import { shouldRasterForStroke } from './stroke.js';

describe('shouldRasterForStroke', () => {
  it('does not raster a shape with no visible stroke, regardless of alignment', () => {
    // Figma's stored default for a shape with no stroke is often
    // strokeAlign: 'INSIDE' — this must NOT trigger a raster.
    expect(shouldRasterForStroke({ visibleStrokeCount: 0, weightIsMixed: false, weight: 0, align: 'INSIDE' })).toBe(false);
  });

  it('does not raster a single centered stroke', () => {
    expect(shouldRasterForStroke({ visibleStrokeCount: 1, weightIsMixed: false, weight: 4, align: 'CENTER' })).toBe(false);
  });

  it('rasters multiple visible strokes', () => {
    expect(shouldRasterForStroke({ visibleStrokeCount: 2, weightIsMixed: false, weight: 1, align: 'CENTER' })).toBe(true);
  });

  it('rasters mixed per-side stroke weights', () => {
    expect(shouldRasterForStroke({ visibleStrokeCount: 1, weightIsMixed: true, weight: 0, align: 'CENTER' })).toBe(true);
  });

  it('does not raster a thin off-center stroke within tolerance (spec §3.3, écart ≤ 0.5pt)', () => {
    // weight 0.8 → deviation 0.4pt, under the 0.5pt threshold
    expect(shouldRasterForStroke({ visibleStrokeCount: 1, weightIsMixed: false, weight: 0.8, align: 'INSIDE' })).toBe(false);
  });

  it('rasters a thick off-center stroke beyond tolerance', () => {
    // weight 2 → deviation 1pt, over the 0.5pt threshold
    expect(shouldRasterForStroke({ visibleStrokeCount: 1, weightIsMixed: false, weight: 2, align: 'OUTSIDE' })).toBe(true);
  });
});
