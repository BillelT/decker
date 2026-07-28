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

  it('falls back to the generic sans-serif substitute for an unknown sans font', () => {
    expect(resolveFontFamily('Cabinet Grotesk')).toEqual({ status: 'substituted', family: 'Inter', original: 'Cabinet Grotesk' });
  });

  it('falls back to the generic serif substitute for an unknown serif font', () => {
    expect(resolveFontFamily('Some Random Serif')).toEqual({ status: 'substituted', family: 'Merriweather', original: 'Some Random Serif' });
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
