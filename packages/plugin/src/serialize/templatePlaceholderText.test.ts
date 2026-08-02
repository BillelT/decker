import { describe, expect, it } from 'vitest';
import type { IRElement, IRShape, IRText } from '@figma-to-slides/shared';
import { applyPlaceholderText } from './templatePlaceholderText.js';

function baseText(overrides: Partial<IRText> = {}): IRText {
  return {
    kind: 'text',
    id: 'el1',
    sourceNodeId: 'n1',
    rect: { x: 0, y: 0, w: 200, h: 40 },
    rotation: 0,
    opacity: 1,
    content: 'Q3 Roadmap',
    runs: [{ start: 0, end: 10, fontFamily: 'Inter', fontWeight: 700, italic: false, fontSizePx: 32, color: { r: 0, g: 0, b: 0, a: 1 } }],
    paragraphs: [{ start: 0, end: 10, align: 'CENTER' }],
    vAlign: 'TOP',
    tightFit: false,
    ...overrides,
  };
}

function baseShape(overrides: Partial<IRShape> = {}): IRShape {
  return {
    kind: 'shape',
    id: 'el2',
    sourceNodeId: 'n2',
    rect: { x: 0, y: 0, w: 10, h: 10 },
    rotation: 0,
    opacity: 1,
    shapeType: 'RECTANGLE',
    ...overrides,
  };
}

describe('applyPlaceholderText', () => {
  it('replaces the real content of a tagged text element with a readable [Label] indicator', () => {
    const elements: IRElement[] = [baseText({ placeholder: { role: 'TITLE', label: 'Title' } })];
    const [result] = applyPlaceholderText(elements) as IRText[];
    expect(result.content).toBe('[Title]');
  });

  it('re-anchors the first run and paragraph to the new (shorter) content, keeping their style', () => {
    const elements: IRElement[] = [baseText({ placeholder: { role: 'BODY', label: 'Body text' } })];
    const [result] = applyPlaceholderText(elements) as IRText[];
    expect(result.runs).toEqual([
      { start: 0, end: '[Body text]'.length, fontFamily: 'Inter', fontWeight: 700, italic: false, fontSizePx: 32, color: { r: 0, g: 0, b: 0, a: 1 } },
    ]);
    expect(result.paragraphs).toEqual([{ start: 0, end: '[Body text]'.length, align: 'CENTER' }]);
  });

  it('leaves an untagged text element untouched', () => {
    const elements: IRElement[] = [baseText()];
    expect(applyPlaceholderText(elements)).toEqual(elements);
  });

  it('leaves non-text elements untouched, even if tagged', () => {
    const elements: IRElement[] = [baseShape({ placeholder: { role: 'IMAGE', label: 'Image' } })];
    expect(applyPlaceholderText(elements)).toEqual(elements);
  });

  it('never mutates the input elements (pure, like the rest of serialize/)', () => {
    const original = baseText({ placeholder: { role: 'TITLE', label: 'Title' } });
    applyPlaceholderText([original]);
    expect(original.content).toBe('Q3 Roadmap');
  });
});
