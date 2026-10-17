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
  it('prefers a subtitle placeholder for any text, the native body bullets cannot be removed on a layout', () => {
    const plan = planTemplateLayouts(
      [slide('content', [text('c', 'TITLE'), text('d', 'BODY')], 0), slide('cover', [text('a', 'TITLE'), text('b', 'SUBTITLE')], 1)],
      LAYOUTS,
    );
    expect(plan.content.layoutName).toBe('TITLE');
    expect(plan.content.placeholderByElementId).toEqual({ c: 't1', d: 't2' });
    expect(plan.cover.layoutName).toBe('TITLE_AND_BODY');
    expect(plan.cover.placeholderByElementId).toEqual({ a: 'b1', b: 'b2' });
  });

  it('copies the subtitle placeholder rather than filling a free bulleted body', () => {
    const layout: NativeLayout = { objectId: 'L_desc', name: 'SECTION_TITLE_AND_DESCRIPTION', placeholders: [slot('x1', 'TITLE'), slot('x2', 'SUBTITLE'), slot('x3', 'BODY')] };
    const plan = planTemplateLayouts([slide('s', [text('k1', 'SUBTITLE'), text('k2', 'BODY')])], [layout]);
    expect(plan.s.placeholderByElementId).toEqual({ k1: 'x2', k2: 'f2s_ph_k2' });
    expect(plan.s.unusedPlaceholderIds).toEqual(['x1', 'x3']);
  });

  it('copies a placeholder when a layout needs more of a type than it has (three cards with a subtitle each)', () => {
    const plan = planTemplateLayouts([slide('cards', [text('t', 'TITLE'), text('s1', 'SUBTITLE'), text('s2', 'SUBTITLE'), text('s3', 'SUBTITLE')])], LAYOUTS);
    expect(plan.cards.layoutName).toBe('TITLE');
    expect(plan.cards.placeholderByElementId).toEqual({ t: 't1', s1: 't2', s2: 'f2s_ph_s2', s3: 'f2s_ph_s3' });
    expect(plan.cards.duplicates).toEqual([
      { sourceId: 't2', objectId: 'f2s_ph_s2' },
      { sourceId: 't2', objectId: 'f2s_ph_s3' },
    ]);
  });

  it('puts a subtitle in a body placeholder when the layout has no subtitle, and a custom text too', () => {
    const plan = planTemplateLayouts([slide('stat', [text('n', 'TITLE'), text('k', 'SUBTITLE'), { ...text('c', undefined), placeholder: { role: 'CUSTOM', label: 'Note' } }])], [LAYOUTS[1]]);
    expect(plan.stat.placeholderByElementId).toEqual({ n: 'b1', k: 'b2', c: 'f2s_ph_c' });
    expect(plan.stat.unusedPlaceholderIds).toEqual(['b3']);
  });

  it('deletes every placeholder left empty', () => {
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
  it('restyles title and body placeholders on the layout, decor and images too, then fills the slide created from it', () => {
    const logo: IRElement = { kind: 'shape', id: 'logo', sourceNodeId: 'n_logo', rect: { x: 600, y: 10, w: 40, h: 40 }, rotation: 0, opacity: 1, shapeType: 'ELLIPSE', placeholder: { role: 'LOGO', label: 'Logo' } };
    const s = slide('content', [text('deco', undefined), text('c', 'TITLE'), text('d', 'BODY'), logo]);
    s.background = { type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } };
    const d = doc([s]);
    const plan = planTemplateLayouts(d.slides, [LAYOUTS[1]]);
    const [batch] = mapDocumentToBatches(d, () => '', UNCALIBRATED_DEFAULTS, 'master', { layouts: LAYOUTS, plan });
    const r = batch.requests as any[];
    const slideIdx = r.findIndex((q) => q.createSlide);

    expect(r[0].updatePageProperties.objectId).toBe('L_body');
    expect(r.find((q) => q.createShape?.objectId === 'deco').createShape.elementProperties.pageObjectId).toBe('L_body');
    expect(r.find((q) => q.createShape?.objectId === 'logo').createShape.elementProperties.pageObjectId).toBe('L_body');
    expect(r.filter((q) => q.updatePageElementTransform).map((q) => q.updatePageElementTransform.objectId)).toEqual(['b1', 'b2']);
    // Google refuse toute écriture de texte dans un placeholder de layout.
    expect(r.some((q) => q.deleteText || ['b1', 'b2'].includes(q.insertText?.objectId))).toBe(false);
    // Puces retirées sur la slide seulement : Google le refuse sur un layout.
    expect(r.filter((q) => q.deleteParagraphBullets).map((q) => q.deleteParagraphBullets.objectId)).toEqual(['b2_s']);
    expect(r.find((q) => q.deleteObject).deleteObject.objectId).toBe('b3');
    expect(r[slideIdx].createSlide).toEqual({
      objectId: 'f2s_page_content',
      slideLayoutReference: { layoutId: 'L_body' },
      placeholderIdMappings: [
        { layoutPlaceholderObjectId: 'b1', objectId: 'b1_s' },
        { layoutPlaceholderObjectId: 'b2', objectId: 'b2_s' },
      ],
    });
    const inserts = r.filter((q, i) => q.insertText && i > slideIdx).map((q) => q.insertText);
    expect(inserts).toEqual([
      { objectId: 'b1_s', text: '[c]', insertionIndex: 0 },
      { objectId: 'b2_s', text: '[d]', insertionIndex: 0 },
    ]);
    expect(r.some((q, i) => i > slideIdx && q.createShape)).toBe(false);
  });

  it('duplicates a layout placeholder before restyling the copy', () => {
    const d = doc([slide('cards', [text('s1', 'SUBTITLE'), text('s2', 'SUBTITLE')])]);
    const plan = planTemplateLayouts(d.slides, [LAYOUTS[0]]);
    const [batch] = mapDocumentToBatches(d, () => '', UNCALIBRATED_DEFAULTS, 'master', { layouts: LAYOUTS, plan });
    const r = batch.requests as any[];
    const dup = r.findIndex((q) => q.duplicateObject);
    expect(r[dup].duplicateObject).toEqual({ objectId: 't2', objectIds: { t2: 'f2s_ph_s2' } });
    expect(r.findIndex((q) => q.updatePageElementTransform?.objectId === 'f2s_ph_s2')).toBeGreaterThan(dup);
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

  it('ignores tags on the master frame: a tagged eyebrow stays a text on the Master, the default title stays hidden', () => {
    const master = slide('m', [text('t', 'TITLE')], 0);
    const d = doc([master], 'm');
    const [masterBatch] = mapDocumentToBatches(d, () => '', UNCALIBRATED_DEFAULTS, 'master-1', { layouts: LAYOUTS, plan: {}, masterTitle: slot('mt', 'TITLE') });
    const r = masterBatch.requests as any[];
    expect(r.find((q) => q.createShape).createShape.objectId).toBe('t');
    expect(r.find((q) => q.updatePageElementTransform).updatePageElementTransform.transform.translateX).toBeLessThan(0);
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
