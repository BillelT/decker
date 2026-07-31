import { describe, expect, it } from 'vitest';
import type { IRElement, IRShape, IRText } from '@figma-to-slides/shared';
import { summarizeColors, summarizeFonts, summarizePlaceholders } from './templateSummary.js';

function baseShape(overrides: Partial<IRShape> = {}): IRShape {
  return {
    kind: 'shape',
    id: 'el1',
    sourceNodeId: 'n1',
    rect: { x: 0, y: 0, w: 10, h: 10 },
    rotation: 0,
    opacity: 1,
    shapeType: 'RECTANGLE',
    ...overrides,
  };
}

function baseText(overrides: Partial<IRText> = {}): IRText {
  return {
    kind: 'text',
    id: 'el2',
    sourceNodeId: 'n2',
    rect: { x: 0, y: 0, w: 10, h: 10 },
    rotation: 0,
    opacity: 1,
    content: 'Hello',
    runs: [],
    paragraphs: [],
    vAlign: 'TOP',
    tightFit: false,
    ...overrides,
  };
}

describe('summarizeColors', () => {
  it('dedupes identical fill colors across elements and counts usage', () => {
    const red = { r: 1, g: 0, b: 0, a: 1 };
    const elements: IRElement[] = [
      baseShape({ fill: { type: 'SOLID', color: red } }),
      baseShape({ id: 'el3', fill: { type: 'SOLID', color: red } }),
    ];
    const colors = summarizeColors(elements);
    expect(colors).toEqual([{ hex: '#FF0000', alpha: 1, usageCount: 2 }]);
  });

  it('treats the same RGB with a different alpha as a distinct swatch', () => {
    const elements: IRElement[] = [
      baseShape({ fill: { type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 } } }),
      baseShape({ id: 'el3', fill: { type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 0.5 } } }),
    ];
    expect(summarizeColors(elements)).toEqual([
      { hex: '#0000FF', alpha: 1, usageCount: 1 },
      { hex: '#0000FF', alpha: 0.5, usageCount: 1 },
    ]);
  });

  it('collects stroke and text run colors too', () => {
    const elements: IRElement[] = [
      baseShape({ stroke: { color: { r: 0, g: 1, b: 0, a: 1 }, weightPt: 1, dash: 'SOLID' } }),
      baseText({ runs: [{ start: 0, end: 5, fontFamily: 'Inter', fontWeight: 400, italic: false, fontSizePx: 16, color: { r: 0, g: 0, b: 0, a: 1 } }] }),
    ];
    const colors = summarizeColors(elements);
    expect(colors).toHaveLength(2);
    expect(colors.map((c) => c.hex)).toEqual(expect.arrayContaining(['#00FF00', '#000000']));
  });
});

describe('summarizeFonts', () => {
  it('groups distinct weights under the same family, sorted ascending', () => {
    const elements: IRElement[] = [
      baseText({
        runs: [
          { start: 0, end: 2, fontFamily: 'Inter', fontWeight: 700, italic: false, fontSizePx: 16, color: { r: 0, g: 0, b: 0, a: 1 } },
          { start: 2, end: 5, fontFamily: 'Inter', fontWeight: 400, italic: false, fontSizePx: 16, color: { r: 0, g: 0, b: 0, a: 1 } },
        ],
      }),
    ];
    expect(summarizeFonts(elements)).toEqual([{ family: 'Inter', weights: [400, 700] }]);
  });

  it('ignores non-text elements', () => {
    expect(summarizeFonts([baseShape()])).toEqual([]);
  });
});

describe('summarizePlaceholders', () => {
  it('collects only elements carrying placeholder metadata, in order', () => {
    const elements: IRElement[] = [
      baseShape({ id: 'a', placeholder: { role: 'IMAGE', label: 'Hero photo' } }),
      baseText({ id: 'b' }),
      baseText({ id: 'c', placeholder: { role: 'TITLE', label: 'Title' } }),
    ];
    expect(summarizePlaceholders(elements)).toEqual([
      { id: 'a', sourceNodeId: 'n1', role: 'IMAGE', label: 'Hero photo' },
      { id: 'c', sourceNodeId: 'n2', role: 'TITLE', label: 'Title' },
    ]);
  });
});
