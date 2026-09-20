import { describe, expect, it } from 'vitest';
import type { IRElement, IRShape, IRText } from '@figma-to-slides/shared';
import { aggregateColorSwatches, aggregateFontUsages, summarizeColors, summarizeFonts, summarizeTaggableElements } from './templateSummary.js';

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

describe('aggregateColorSwatches', () => {
  it('sums usage counts for the same color across layouts (audit 2026-08, onglet Style)', () => {
    const layoutA = [{ hex: '#FF6B00', alpha: 1, usageCount: 2 }];
    const layoutB = [{ hex: '#FF6B00', alpha: 1, usageCount: 3 }];
    expect(aggregateColorSwatches([layoutA, layoutB])).toEqual([{ hex: '#FF6B00', alpha: 1, usageCount: 5 }]);
  });

  it('keeps distinct hex+alpha swatches separate, in first-seen order', () => {
    const layoutA = [{ hex: '#000000', alpha: 1, usageCount: 1 }];
    const layoutB = [
      { hex: '#FFFFFF', alpha: 1, usageCount: 1 },
      { hex: '#000000', alpha: 1, usageCount: 4 },
    ];
    expect(aggregateColorSwatches([layoutA, layoutB])).toEqual([
      { hex: '#000000', alpha: 1, usageCount: 5 },
      { hex: '#FFFFFF', alpha: 1, usageCount: 1 },
    ]);
  });

  it('returns an empty list for an empty template', () => {
    expect(aggregateColorSwatches([])).toEqual([]);
  });
});

describe('aggregateFontUsages', () => {
  it('merges weights for the same family across layouts', () => {
    const layoutA = [{ family: 'Inter', weights: [400] }];
    const layoutB = [{ family: 'Inter', weights: [700] }];
    expect(aggregateFontUsages([layoutA, layoutB])).toEqual([{ family: 'Inter', weights: [400, 700] }]);
  });

  it('keeps distinct families separate', () => {
    const layoutA = [{ family: 'Inter', weights: [400] }];
    const layoutB = [{ family: 'Cabinet Grotesk', weights: [700] }];
    expect(aggregateFontUsages([layoutA, layoutB])).toEqual([
      { family: 'Inter', weights: [400] },
      { family: 'Cabinet Grotesk', weights: [700] },
    ]);
  });
});


describe('summarizeTaggableElements', () => {
  it('lists every taggable layer, not just the tagged ones', () => {
    const elements: IRElement[] = [
      baseText({ id: 'a', sourceNodeId: 'na', sourceNodeName: 'Heading' }),
      baseShape({ id: 'b', sourceNodeId: 'nb', sourceNodeName: 'Photo slot', placeholder: { role: 'IMAGE', label: 'Image' } }),
    ];
    expect(summarizeTaggableElements(elements)).toEqual([
      { id: 'a', sourceNodeId: 'na', name: 'Heading', kind: 'text', role: undefined, label: undefined },
      { id: 'b', sourceNodeId: 'nb', name: 'Photo slot', kind: 'shape', role: 'IMAGE', label: 'Image' },
    ]);
  });

  it('skips untagged lines, which are never placeholders', () => {
    const line: IRElement = {
      kind: 'line',
      id: 'l1',
      sourceNodeId: 'nl',
      sourceNodeName: 'Divider',
      rect: { x: 0, y: 0, w: 10, h: 1 },
      rotation: 0,
      opacity: 1,
      stroke: { color: { r: 0, g: 0, b: 0, a: 1 }, weightPt: 1, dash: 'SOLID' },
    };
    expect(summarizeTaggableElements([line])).toEqual([]);
  });

  it('keeps a tagged line, so its tag can still be removed from the panel', () => {
    const line: IRElement = {
      kind: 'line',
      id: 'l1',
      sourceNodeId: 'nl',
      sourceNodeName: 'Divider',
      rect: { x: 0, y: 0, w: 10, h: 1 },
      rotation: 0,
      opacity: 1,
      stroke: { color: { r: 0, g: 0, b: 0, a: 1 }, weightPt: 1, dash: 'SOLID' },
      placeholder: { role: 'CUSTOM', label: 'Rule' },
    };
    expect(summarizeTaggableElements([line])).toHaveLength(1);
  });

  it('falls back to the placeholder label, then to the kind, when the layer name is missing', () => {
    const elements: IRElement[] = [
      baseText({ id: 'a', sourceNodeId: 'na', placeholder: { role: 'TITLE', label: 'Title' } }),
      baseShape({ id: 'b', sourceNodeId: 'nb' }),
    ];
    expect(summarizeTaggableElements(elements).map((e) => e.name)).toEqual(['Title', 'shape']);
  });
});
