import { describe, expect, it } from 'vitest';
import type { IRDocument, IRElement, IRSlide, IRText } from '@figma-to-slides/shared';
import { UNCALIBRATED_DEFAULTS } from '@figma-to-slides/shared';
import { mapDocumentToBatches } from './index.js';
import { planTemplateLayouts, type LayoutPlaceholder, type NativeLayout } from './templateLayouts.js';

const EMU = 12700;

function slot(objectId: string, type: string, x = 0, textLength = 0): LayoutPlaceholder {
  return { objectId, type, index: 0, widthEmu: 100 * EMU, heightEmu: 50 * EMU, translateXEmu: x * EMU, textLength };
}

const LAYOUTS: NativeLayout[] = [
  { objectId: 'L_title', name: 'TITLE', placeholders: [slot('t1', 'CENTERED_TITLE'), slot('t2', 'SUBTITLE')] },
  { objectId: 'L_body', name: 'TITLE_AND_BODY', placeholders: [slot('b1', 'TITLE', 0, 12), slot('b2', 'BODY'), slot('b3', 'SLIDE_NUMBER')] },
  { objectId: 'L_two', name: 'TITLE_AND_TWO_COLUMNS', placeholders: [slot('c1', 'TITLE'), slot('c2', 'BODY', 300), slot('c3', 'BODY', 20)] },
  { objectId: 'L_blank', name: 'BLANK', placeholders: [slot('k1', 'SLIDE_NUMBER')] },
];

function text(id: string, role: 'TITLE' | 'SUBTITLE' | 'BODY' | undefined, x = 0): IRText {
  return {
    kind: 'text',
    id,
    sourceNodeId: `n_${id}`,
    rect: { x, y: 10, w: 200, h: 40 },
    rotation: 0,
    opacity: 1,
    content: `[${id}]`,
    runs: [{ start: 0, end: id.length + 2, fontFamily: 'Inter', fontWeight: 400, italic: false, fontSizePx: 32, color: { r: 0, g: 0, b: 0, a: 1 } }],
    paragraphs: [],
    vAlign: 'TOP',
    tightFit: false,
    ...(role ? { placeholder: { role, label: role } } : {}),
  };
}

function slide(sourceNodeId: string, elements: IRElement[], order = 0): IRSlide {
  return { sourceNodeId, frameName: sourceNodeId, order, frameSize: { width: 720, height: 405 }, elements, warnings: [], previewDataUrl: '' };
}

describe('planTemplateLayouts', () => {
  it('gives each frame the native layout that holds its roles with the fewest extra text placeholders', () => {
    const plan = planTemplateLayouts(
      [slide('cover', [text('a', 'TITLE'), text('b', 'SUBTITLE')], 0), slide('content', [text('c', 'TITLE'), text('d', 'BODY')], 1)],
      LAYOUTS,
    );
    expect(plan.cover.layoutName).toBe('TITLE');
    expect(plan.content.layoutName).toBe('TITLE_AND_BODY');
    expect(plan.content.placeholderByElementId).toEqual({ c: 'b1', d: 'b2' });
    expect(plan.content.unusedPlaceholderIds).toEqual(['b3']);
  });

  it('maps two bodies left to right onto the two columns', () => {
    const plan = planTemplateLayouts([slide('cols', [text('t', 'TITLE'), text('right', 'BODY', 400), text('left', 'BODY', 10)])], LAYOUTS);
    expect(plan.cols.layoutName).toBe('TITLE_AND_TWO_COLUMNS');
    expect(plan.cols.placeholderByElementId).toEqual({ t: 'c1', left: 'c3', right: 'c2' });
  });

  it('never gives the same layout twice, and leaves a frame without a fitting layout on the old path', () => {
    const plan = planTemplateLayouts(
      [slide('a', [text('a1', 'TITLE'), text('a2', 'SUBTITLE')], 0), slide('b', [text('b1', 'TITLE'), text('b2', 'SUBTITLE')], 1)],
      LAYOUTS,
    );
    expect(plan.a.layoutName).toBe('TITLE');
    expect(plan.b).toBeUndefined();
  });
});

describe('mapDocumentToBatches with template layouts', () => {
  it('restyles the native placeholder, puts the rest on the layout, then creates the slide from it', () => {
    const s = slide('content', [text('deco', undefined), text('c', 'TITLE'), text('d', 'BODY')]);
    s.background = { type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } };
    const doc: IRDocument = {
      version: 1,
      presentationTitle: 'T',
      slideSize: { widthPt: 720, heightPt: 405 },
      slides: [s],
      options: { mode: 'new-presentation', rasterScale: 2, includeUnderlay: false, underlayOpacity: 0.3, strictMode: true },
      kind: 'template',
    };
    const plan = planTemplateLayouts(doc.slides, LAYOUTS);
    const [batch] = mapDocumentToBatches(doc, () => '', UNCALIBRATED_DEFAULTS, undefined, { layouts: LAYOUTS, plan });
    const r = batch.requests as any[];

    expect(r[0].updatePageProperties.objectId).toBe('L_body');
    expect(r.find((q) => q.createShape)?.createShape.objectId).toBe('deco');
    expect(r.find((q) => q.createShape)?.createShape.elementProperties.pageObjectId).toBe('L_body');
    expect(r.some((q) => q.createShape?.objectId === 'c')).toBe(false);
    const transform = r.find((q) => q.updatePageElementTransform?.objectId === 'b1');
    expect(transform.updatePageElementTransform.applyMode).toBe('ABSOLUTE');
    // Google refuse toute écriture de texte dans un placeholder de layout.
    expect(r.some((q) => q.deleteText || q.insertText?.objectId === 'b1')).toBe(false);
    const style = r.find((q) => q.updateTextStyle?.objectId === 'b1')?.updateTextStyle;
    expect(style.textRange).toEqual({ type: 'ALL' });
    expect(style.style.fontSize).toEqual({ magnitude: 32, unit: 'PT' });
    expect(r.some((q) => q.deleteObject?.objectId === 'b3')).toBe(true);
    expect(r[r.length - 1]).toEqual({
      createSlide: {
        objectId: 'f2s_page_content',
        slideLayoutReference: { layoutId: 'L_body' },
        placeholderIdMappings: [
          { layoutPlaceholderObjectId: 'b1', objectId: 'b1_s' },
          { layoutPlaceholderObjectId: 'b2', objectId: 'b2_s' },
        ],
      },
    });
  });
});
