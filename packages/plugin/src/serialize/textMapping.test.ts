import { describe, expect, it } from 'vitest';
import { applyTextCase, letterSpacingImpactRatio, mapAlignment, mapLineSpacing, mapVerticalAlignment } from './textMapping.js';

describe('mapAlignment', () => {
  it.each([
    ['LEFT', 'START'],
    ['CENTER', 'CENTER'],
    ['RIGHT', 'END'],
    ['JUSTIFIED', 'JUSTIFIED'],
  ] as const)('%s → %s', (input, expected) => {
    expect(mapAlignment(input)).toBe(expected);
  });
});

describe('mapVerticalAlignment', () => {
  it('maps CENTER to MIDDLE, others pass through', () => {
    expect(mapVerticalAlignment('CENTER')).toBe('MIDDLE');
    expect(mapVerticalAlignment('TOP')).toBe('TOP');
    expect(mapVerticalAlignment('BOTTOM')).toBe('BOTTOM');
  });
});

describe('applyTextCase', () => {
  it('uppercases', () => expect(applyTextCase('Hello World', 'UPPER')).toBe('HELLO WORLD'));
  it('lowercases', () => expect(applyTextCase('Hello World', 'LOWER')).toBe('hello world'));
  it('title-cases', () => expect(applyTextCase('hello world', 'TITLE')).toBe('Hello World'));
  it('leaves SMALL_CAPS content untouched (handled via textStyle.smallCaps)', () => {
    expect(applyTextCase('Hello', 'SMALL_CAPS')).toBe('Hello');
  });
  it('leaves ORIGINAL untouched', () => expect(applyTextCase('Hello', 'ORIGINAL')).toBe('Hello'));
});

describe('mapLineSpacing', () => {
  it('does not send a value for AUTO', () => {
    expect(mapLineSpacing({ unit: 'AUTO' }, 16)).toBeUndefined();
  });

  it('passes PERCENT through unchanged', () => {
    expect(mapLineSpacing({ unit: 'PERCENT', value: 150 }, 16)).toBe(150);
  });

  it('converts PIXELS to a percentage of fontSize', () => {
    expect(mapLineSpacing({ unit: 'PIXELS', value: 24 }, 16)).toBe(150);
  });
});

describe('letterSpacingImpactRatio', () => {
  it('computes the fractional width impact', () => {
    // 10 chars, 1px spacing each gap (9 gaps) over a 100px-wide word → 9%
    expect(letterSpacingImpactRatio(1, 10, 100)).toBeCloseTo(0.09);
  });

  it('returns 0 for a single character or zero width', () => {
    expect(letterSpacingImpactRatio(5, 1, 100)).toBe(0);
    expect(letterSpacingImpactRatio(5, 10, 0)).toBe(0);
  });
});
