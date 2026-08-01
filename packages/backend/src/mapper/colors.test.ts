import { describe, expect, it } from 'vitest';
import { combinedAlpha, toOpaqueColor, toSolidFill } from './colors.js';

describe('toOpaqueColor', () => {
  it('passes through 0..1 components unchanged', () => {
    expect(toOpaqueColor({ r: 0.5, g: 0.25, b: 1 })).toEqual({
      rgbColor: { red: 0.5, green: 0.25, blue: 1 },
    });
  });

  it('clamps out-of-range components (spec §11.1 — a color > 1 renders white silently)', () => {
    expect(toOpaqueColor({ r: 1.4, g: -0.2, b: 0.5 })).toEqual({
      rgbColor: { red: 1, green: 0, blue: 0.5 },
    });
  });

  it('emits themeColor instead of rgbColor when themeRole is set (audit 2026-08, mode template)', () => {
    expect(toOpaqueColor({ r: 1, g: 0, b: 0, themeRole: 'ACCENT1' })).toEqual({ themeColor: 'ACCENT1' });
  });
});

describe('toSolidFill', () => {
  it('carries alpha from the color', () => {
    expect(toSolidFill({ r: 1, g: 0, b: 0, a: 0.4 })).toEqual({
      color: { rgbColor: { red: 1, green: 0, blue: 0 } },
      alpha: 0.4,
    });
  });

  it('carries themeRole through to a themeColor binding, alpha unaffected', () => {
    expect(toSolidFill({ r: 1, g: 0, b: 0, a: 0.4, themeRole: 'ACCENT2' })).toEqual({
      color: { themeColor: 'ACCENT2' },
      alpha: 0.4,
    });
  });
});

describe('combinedAlpha', () => {
  it('multiplies fill opacity and node opacity (spec §3.6)', () => {
    expect(combinedAlpha(0.5, 0.5)).toBeCloseTo(0.25);
  });

  it('defaults both factors to 1', () => {
    expect(combinedAlpha()).toBe(1);
  });

  it('clamps the product to [0,1]', () => {
    expect(combinedAlpha(2, 2)).toBe(1);
  });
});
