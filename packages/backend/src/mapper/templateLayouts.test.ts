import { describe, expect, it } from 'vitest';
import type { IRDocument, IRElement, IRSlide, IRText } from '@figma-to-slides/shared';
import { UNCALIBRATED_DEFAULTS } from '@figma-to-slides/shared';
import { mapDocumentToBatches } from './index.js';
import { planTemplateLayouts, widenForPrompt, type LayoutPlaceholder, type NativeLayout } from './templateLayouts.js';

const EMU = 12700;

function slot(objectId: string, type: string): LayoutPlaceholder {
  return { objectId, type, index: 0, widthEmu: 100 * EMU, heightEmu: 50 * EMU, translateXEmu: 0, textLength: 12 };
}

const LAYOUTS: NativeLayout[] = [
  { objectId: 'L_title', name: 'TITLE', placeholders: [slot('t1', 'CENTERED_TITLE'), slot('t2', 'SUBTITLE')] },
  { objectId: 'L_body', name: 'TITLE_AND_BODY', placeholders: [slot('b1', 'TITLE'), slot('b2', 'BODY'), slot('b3', 'SLIDE_NUMBER')] },
  { objectId: 'L_only', name: 'TITLE_ONLY', placeholders: [slot('o1', 'TITLE')] },
];

function text(id: string, role: 'TITLE' | 'SUBTITLE' | 'BODY' | undefined): IRText {
  return {
    kind: 'text',
    id,
    sourceNodeId: `n_${id}`,
    rect: { x: 10, y: 10, w: 200, h: 40 },
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

function doc(slides: IRSlide[], masterSlideId?: string): IRDocument {
  return {
    version: 1,
    presentationTitle: 'T',
    slideSize: { widthPt: 720, heightPt: 405 },
    slides,
    options: { mode: 'new-presentation', rasterScale: 2, includeUnderlay: false, underlayOpacity: 0.3, strictMode: true },
    kind: 'template',
    masterSlideId,
  };
}

describe('planTemplateLayouts', () => {
  it('gives the subtitle layout to the frame that needs it, and the leanest title layout to the other', () => {
    const plan = planTemplateLayouts(
      [slide('content', [text('c', 'TITLE'), text('d', 'BODY')], 0), slide('cover', [text('a', 'TITLE'), text('b', 'SUBTITLE')], 1)],
      LAYOUTS,
    );
    expect(plan.cover.layoutName).toBe('TITLE');
    expect(plan.cover.placeholderByElementId).toEqual({ a: 't1', b: 't2' });
    expect(plan.content.layoutName).toBe('TITLE_ONLY');
    expect(plan.content.placeholderByElementId).toEqual({ c: 'o1' });
  });

  it('never uses a native body placeholder, and deletes every text slot left empty', () => {
    const plan = planTemplateLayouts([slide('a', [text('a1', 'TITLE')]), slide('b', [text('b1', 'TITLE')]), slide('c', [text('c1', 'TITLE')])], LAYOUTS);
    const body = Object.values(plan).find((p) => p.layoutName === 'TITLE_AND_BODY')!;
    expect(body.unusedPlaceholderIds).toEqual(['b2', 'b3']);
  });

  it('gives no layout to the master frame, and none once they run out', () => {
    const slides = [0, 1, 2, 3, 4].map((i) => slide(`s${i}`, [text(`t${i}`, 'TITLE')], i));
    const plan = planTemplateLayouts(slides, LAYOUTS, 's0');
    expect(plan.s0).toBeUndefined();
    expect(Object.keys(plan)).toHaveLength(3);
  });
});

describe('mapDocumentToBatches with template layouts', () => {
  it('restyles the title placeholder, puts decor on the layout, the body on the slide created from it', () => {
    const s = slide('content', [text('deco', undefined), text('c', 'TITLE'), text('d', 'BODY')]);
    s.background = { type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } };
    const d = doc([s]);
    const plan = planTemplateLayouts(d.slides, LAYOUTS);
    const [batch] = mapDocumentToBatches(d, () => '', UNCALIBRATED_DEFAULTS, 'master', { layouts: LAYOUTS, plan });
    const r = batch.requests as any[];
    const slideIdx = r.findIndex((q) => q.createSlide);

    expect(r[0].updatePageProperties.objectId).toBe('L_only');
    expect(r.find((q) => q.createShape?.objectId === 'deco').createShape.elementProperties.pageObjectId).toBe('L_only');
    expect(r.find((q) => q.updatePageElementTransform)?.updatePageElementTransform.objectId).toBe('o1');
    // Google refuse toute écriture de texte dans un placeholder de layout.
    expect(r.some((q) => q.deleteText || q.insertText?.objectId === 'o1')).toBe(false);
    expect(r.find((q) => q.updateTextStyle?.objectId === 'o1').updateTextStyle.textRange).toEqual({ type: 'ALL' });
    expect(r[slideIdx].createSlide).toEqual({
      objectId: 'f2s_page_content',
      slideLayoutReference: { layoutId: 'L_only' },
      placeholderIdMappings: [{ layoutPlaceholderObjectId: 'o1', objectId: 'o1_s' }],
    });
    const body = r.findIndex((q) => q.createShape?.objectId === 'd');
    expect(body).toBeGreaterThan(slideIdx);
    expect(r[body].createShape.elementProperties.pageObjectId).toBe('f2s_page_content');
  });

  it('writes the master frame on the Master page, without creating a slide', () => {
    const master = slide('m', [text('logo', undefined)], 0);
    master.background = { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } };
    const d = doc([master, slide('l', [text('t', 'TITLE')], 1)], 'm');
    const plan = planTemplateLayouts(d.slides, LAYOUTS, 'm');
    const [masterBatch] = mapDocumentToBatches(d, () => '', UNCALIBRATED_DEFAULTS, 'master-1', { layouts: LAYOUTS, plan });
    const r = masterBatch.requests as any[];
    expect(masterBatch.sourceSlideId).toBe('m');
    expect(r[0].updatePageProperties.objectId).toBe('master-1');
    expect(r.find((q) => q.createShape).createShape.elementProperties.pageObjectId).toBe('master-1');
    expect(r.some((q) => q.createSlide)).toBe(false);
  });

  it('hides the default Master title off the slide when the master frame has no title', () => {
    const master = slide('m', [text('logo', undefined)], 0);
    const d = doc([master], 'm');
    const [masterBatch] = mapDocumentToBatches(d, () => '', UNCALIBRATED_DEFAULTS, 'master-1', { layouts: LAYOUTS, plan: {}, masterTitle: slot('mt', 'TITLE') });
    const r = masterBatch.requests as any[];
    const move = r.find((q) => q.updatePageElementTransform);
    expect(move.updatePageElementTransform.objectId).toBe('mt');
    expect(move.updatePageElementTransform.transform.translateX).toBeLessThan(0);
    expect(r.find((q) => q.updateTextStyle?.objectId === 'mt').updateTextStyle).toMatchObject({ style: { fontSize: { magnitude: 1 } } });
    expect(r.some((q) => q.deleteObject)).toBe(false);
  });

  it('puts the master frame title on the default Master title instead of a text box', () => {
    const master = slide('m', [text('t', 'TITLE')], 0);
    const d = doc([master], 'm');
    const [masterBatch] = mapDocumentToBatches(d, () => '', UNCALIBRATED_DEFAULTS, 'master-1', { layouts: LAYOUTS, plan: {}, masterTitle: slot('mt', 'TITLE') });
    const r = masterBatch.requests as any[];
    expect(r.some((q) => q.createShape)).toBe(false);
    const move = r.find((q) => q.updatePageElementTransform).updatePageElementTransform;
    expect(move.objectId).toBe('mt');
    expect(move.transform.translateX).toBeGreaterThanOrEqual(0);
    expect(r.find((q) => q.updateTextStyle).updateTextStyle.objectId).toBe('mt');
  });
});

describe('widenForPrompt', () => {
  const hug = (x: number, w: number, align: 'START' | 'CENTER' | 'END'): IRText => ({
    ...text('t', 'TITLE'),
    rect: { x, y: 10, w, h: 40 },
    tightFit: true,
    paragraphs: [{ start: 0, end: 3, align }],
  });

  it('keeps the left edge of a left-aligned hug text and mirrors its margin on the right', () => {
    expect(widenForPrompt(hug(40, 100, 'START'), 720).rect).toMatchObject({ x: 40, w: 640 });
  });

  it('keeps a right-aligned text on its right edge', () => {
    const r = widenForPrompt(hug(500, 180, 'END'), 720).rect;
    expect(r.x + r.w).toBe(680);
    expect(r.x).toBe(40);
  });

  it('widens a centered text around its center with the smaller margin', () => {
    expect(widenForPrompt(hug(300, 120, 'CENTER'), 720).rect).toMatchObject({ x: 300, w: 120 });
    expect(widenForPrompt(hug(310, 100, 'CENTER'), 720).rect).toMatchObject({ x: 310, w: 100 });
    expect(widenForPrompt(hug(200, 100, 'CENTER'), 720).rect).toMatchObject({ x: 200, w: 320 });
  });

  it('leaves fixed-width and rotated texts alone', () => {
    const fixed = { ...hug(40, 100, 'START'), tightFit: false };
    expect(widenForPrompt(fixed, 720)).toBe(fixed);
    const rotated = { ...hug(40, 100, 'START'), rotation: 90 };
    expect(widenForPrompt(rotated, 720)).toBe(rotated);
  });
});
