import { describe, expect, it } from 'vitest';
import { parseFontWeight, resolveFontFamily } from './fonts.js';

describe('resolveFontFamily', () => {
  it('resolves a Google Font directly', () => {
    expect(resolveFontFamily('Inter')).toEqual({ status: 'available', family: 'Inter' });
  });

  it('resolves a Slides system font directly', () => {
    expect(resolveFontFamily('Arial')).toEqual({ status: 'available', family: 'Arial' });
  });

  it('substitutes a known unavailable font (spec §3.5 example)', () => {
    expect(resolveFontFamily('SF Pro Display')).toEqual({ status: 'substituted', family: 'Inter', original: 'SF Pro Display' });
  });

  it('reports missing for an unknown, non-substitutable font', () => {
    expect(resolveFontFamily('Some Random Custom Font')).toEqual({ status: 'missing', original: 'Some Random Custom Font' });
  });
});

describe('parseFontWeight', () => {
  it.each([
    ['Regular', 400],
    ['Bold', 700],
    ['Semi Bold', 600],
    ['Light', 300],
    ['Black', 900],
    ['Extra Bold', 800],
    ['Thin', 100],
  ])('parses "%s" as %i', (style, expected) => {
    expect(parseFontWeight(style)).toBe(expected);
  });

  it('defaults unknown styles to 400', () => {
    expect(parseFontWeight('Condensed Italic')).toBe(400);
  });
});
