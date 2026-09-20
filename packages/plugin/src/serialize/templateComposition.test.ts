import { describe, expect, it } from 'vitest';
import type { IRElement, IRImage, IRLine, IRShape, IRText } from '@figma-to-slides/shared';
import { collectCompositionWarnings } from './templateComposition.js';

let counter = 0;
function ids() {
  counter++;
  return { id: `el${counter}`, sourceNodeId: `n${counter}` };
}

function text(overrides: Partial<IRText> = {}): IRText {
  return {
    kind: 'text',
    ...ids(),
    sourceNodeName: 'Heading',
    rect: { x: 0, y: 0, w: 200, h: 40 },
    rotation: 0,
    opacity: 1,
    content: 'Q3 Roadmap',
    runs: [],
    paragraphs: [],
    vAlign: 'TOP',
    tightFit: false,
    ...overrides,
  };
}

function shape(overrides: Partial<IRShape> = {}): IRShape {
  return {
    kind: 'shape',
    ...ids(),
    sourceNodeName: 'Image slot',
    rect: { x: 0, y: 0, w: 100, h: 100 },
    rotation: 0,
    opacity: 1,
    shapeType: 'RECTANGLE',
    ...overrides,
  };
}

function image(overrides: Partial<IRImage> = {}): IRImage {
  return {
    kind: 'image',
    ...ids(),
    sourceNodeName: 'Hero photo',
    rect: { x: 0, y: 0, w: 100, h: 100 },
    rotation: 0,
    opacity: 1,
    assetKey: 'a1',
    isRasterFallback: false,
    ...overrides,
  };
}

function line(overrides: Partial<IRLine> = {}): IRLine {
  return {
    kind: 'line',
    ...ids(),
    sourceNodeName: 'Rule',
    rect: { x: 0, y: 0, w: 100, h: 1 },
    rotation: 0,
    opacity: 1,
    stroke: { color: { r: 0, g: 0, b: 0, a: 1 }, weightPt: 1, dash: 'SOLID' },
    ...overrides,
  };
}

function run(elements: IRElement[]) {
  return collectCompositionWarnings({ sourceNodeId: 'layout1', frameName: 'Cover', elements });
}

describe('collectCompositionWarnings', () => {
  it('flags a layout with no placeholder at all, anchored on the layout frame itself', () => {
    const warnings = run([text(), shape()]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('LAYOUT_WITHOUT_PLACEHOLDER');
    expect(warnings[0].severity).toBe('info');
    expect(warnings[0].sourceNodeId).toBe('layout1');
    expect(warnings[0].nodeName).toBe('Cover');
  });

  it('stays silent on a well-formed layout', () => {
    const warnings = run([
      text({ placeholder: { role: 'TITLE', label: 'Title' } }),
      text({ placeholder: { role: 'BODY', label: 'Body text' } }),
      shape({ placeholder: { role: 'IMAGE', label: 'Image' } }),
    ]);
    expect(warnings).toEqual([]);
  });

  it('flags every occurrence of a duplicated role, not just the extra ones', () => {
    const warnings = run([
      text({ sourceNodeName: 'Big title', placeholder: { role: 'TITLE', label: 'Title' } }),
      text({ sourceNodeName: 'Small title', placeholder: { role: 'TITLE', label: 'Title' } }),
    ]);
    const duplicates = warnings.filter((w) => w.code === 'PLACEHOLDER_ROLE_DUPLICATE');
    expect(duplicates).toHaveLength(2);
    expect(duplicates.map((w) => w.nodeName)).toEqual(['Big title', 'Small title']);
    expect(duplicates[0].message).toContain('[[title]]');
    expect(duplicates[0].severity).toBe('warning');
  });

  it('never treats two differently labelled custom placeholders as duplicates', () => {
    const warnings = run([
      text({ placeholder: { role: 'CUSTOM', label: 'Footnote' } }),
      text({ placeholder: { role: 'CUSTOM', label: 'Legal mention' } }),
    ]);
    expect(warnings.filter((w) => w.code === 'PLACEHOLDER_ROLE_DUPLICATE')).toEqual([]);
  });

  it('flags two custom placeholders that share the same label, case-insensitively', () => {
    const warnings = run([
      text({ placeholder: { role: 'CUSTOM', label: 'Footnote' } }),
      text({ placeholder: { role: 'CUSTOM', label: 'footnote' } }),
    ]);
    const duplicates = warnings.filter((w) => w.code === 'PLACEHOLDER_ROLE_DUPLICATE');
    expect(duplicates).toHaveLength(2);
    expect(duplicates[0].message).toContain('[[custom:Footnote]]');
  });

  it('flags a text role posted on a layer that is not text', () => {
    const warnings = run([shape({ placeholder: { role: 'TITLE', label: 'Title' } })]);
    const mismatch = warnings.filter((w) => w.code === 'PLACEHOLDER_ROLE_KIND_MISMATCH');
    expect(mismatch).toHaveLength(1);
    expect(mismatch[0].message).toContain('[[title]]');
  });

  it('flags [[image]] posted on a text layer', () => {
    const warnings = run([text({ placeholder: { role: 'IMAGE', label: 'Image' } })]);
    expect(warnings.filter((w) => w.code === 'PLACEHOLDER_ROLE_KIND_MISMATCH')).toHaveLength(1);
  });

  it('accepts [[image]] on an empty shape reserving the spot, and on a real image', () => {
    const warnings = run([
      shape({ placeholder: { role: 'IMAGE', label: 'Image' } }),
      image({ placeholder: { role: 'LOGO', label: 'Logo' } }),
    ]);
    expect(warnings.filter((w) => w.code === 'PLACEHOLDER_ROLE_KIND_MISMATCH')).toEqual([]);
  });

  it('flags [[logo]] posted on a line', () => {
    const warnings = run([line({ placeholder: { role: 'LOGO', label: 'Logo' } })]);
    expect(warnings.filter((w) => w.code === 'PLACEHOLDER_ROLE_KIND_MISMATCH')).toHaveLength(1);
  });

  it('never flags a kind mismatch for CUSTOM, which covers anything by design', () => {
    const warnings = run([line({ placeholder: { role: 'CUSTOM', label: 'Divider' } })]);
    expect(warnings).toEqual([]);
  });

  it('falls back to the placeholder label when the element carries no layer name', () => {
    const warnings = run([shape({ sourceNodeName: undefined, placeholder: { role: 'TITLE', label: 'Title' } })]);
    expect(warnings[0].nodeName).toBe('Title');
  });
});
