import { describe, expect, it } from 'vitest';
import type { IRText } from '@figma-to-slides/shared';
import { UNCALIBRATED_DEFAULTS } from '@figma-to-slides/shared';
import { mapText } from './text.js';

function baseText(overrides: Partial<IRText> = {}): IRText {
  return {
    kind: 'text',
    id: 'f2s_job1_2',
    sourceNodeId: 'node2',
    rect: { x: 10, y: 10, w: 200, h: 40 },
    rotation: 0,
    opacity: 1,
    content: 'Hello world',
    vAlign: 'TOP',
    runs: [
      {
        start: 0,
        end: 11,
        fontFamily: 'Inter',
        fontWeight: 400,
        italic: false,
        fontSizePx: 16,
        color: { r: 0, g: 0, b: 0, a: 1 },
      },
    ],
    paragraphs: [{ start: 0, end: 11, align: 'START' }],
    ...overrides,
  };
}

describe('mapText', () => {
  it('orders requests as createShape → updateShapeProperties → insertText → styles (piège §11.7)', () => {
    const reqs = mapText(baseText(), 'page1', 1, 0, 0, UNCALIBRATED_DEFAULTS);
    const kinds = reqs.map((r) => Object.keys(r)[0]);
    expect(kinds).toEqual([
      'createShape',
      'updateShapeProperties',
      'insertText',
      'updateTextStyle',
      'updateParagraphStyle',
    ]);
  });

  it('compensates the calibrated text inset (spec §3.5)', () => {
    const inset = UNCALIBRATED_DEFAULTS.textInset;
    const safetyMargin = 16 * UNCALIBRATED_DEFAULTS.textWidthSafetyMarginEm; // fontSizePx=16, scale=1
    const [createReq] = mapText(baseText(), 'page1', 1, 0, 0, UNCALIBRATED_DEFAULTS) as any;
    expect(createReq.createShape.elementProperties.size.width.magnitude).toBeCloseTo(200 + inset.left + inset.right + safetyMargin);
    expect(createReq.createShape.elementProperties.transform.translateX).toBeCloseTo(10 - inset.left);
  });

  it('scales the width safety margin with the largest run font size', () => {
    const text = baseText({
      runs: [
        { start: 0, end: 5, fontFamily: 'Inter', fontWeight: 400, italic: false, fontSizePx: 16, color: { r: 0, g: 0, b: 0, a: 1 } },
        { start: 5, end: 11, fontFamily: 'Inter', fontWeight: 700, italic: false, fontSizePx: 40, color: { r: 0, g: 0, b: 0, a: 1 } },
      ],
    });
    const inset = UNCALIBRATED_DEFAULTS.textInset;
    const safetyMargin = 40 * UNCALIBRATED_DEFAULTS.textWidthSafetyMarginEm; // largest run wins
    const [createReq] = mapText(text, 'page1', 1, 0, 0, UNCALIBRATED_DEFAULTS) as any;
    expect(createReq.createShape.elementProperties.size.width.magnitude).toBeCloseTo(200 + inset.left + inset.right + safetyMargin);
  });

  it('scales font size along with geometry', () => {
    const reqs = mapText(baseText(), 'page1', 2, 0, 0, UNCALIBRATED_DEFAULTS);
    const styleReq = reqs.find((r) => 'updateTextStyle' in r) as any;
    expect(styleReq.updateTextStyle.style.fontSize.magnitude).toBe(32);
  });

  it('uses weightedFontFamily rather than bold+fontFamily (spec §3.5 table)', () => {
    const reqs = mapText(baseText(), 'page1', 1, 0, 0, UNCALIBRATED_DEFAULTS);
    const styleReq = reqs.find((r) => 'updateTextStyle' in r) as any;
    expect(styleReq.updateTextStyle.style.weightedFontFamily).toEqual({ fontFamily: 'Inter', weight: 400 });
  });

  it('emits createParagraphBullets for list paragraphs', () => {
    const text = baseText({
      paragraphs: [{ start: 0, end: 11, align: 'START', bullet: 'UNORDERED' }],
    });
    const reqs = mapText(text, 'page1', 1, 0, 0, UNCALIBRATED_DEFAULTS);
    const bulletReq = reqs.find((r) => 'createParagraphBullets' in r) as any;
    expect(bulletReq.createParagraphBullets.bulletPreset).toBe('BULLET_DISC_CIRCLE_SQUARE');
  });

  it('skips text-body requests entirely for empty content', () => {
    const reqs = mapText(baseText({ content: '', runs: [], paragraphs: [] }), 'page1', 1, 0, 0, UNCALIBRATED_DEFAULTS);
    expect(reqs.some((r) => 'insertText' in r)).toBe(false);
  });

  it('skips updateParagraphStyle/createParagraphBullets for a degenerate empty-range paragraph', () => {
    // Régression : la Slides API rejette tout textRange avec startIndex >=
    // endIndex (400 "must be less than endIndex"). Ce cas ne devrait plus
    // être produit par le plugin (voir textExtract.ts), mais on garde ce
    // garde-fou côté backend pour ne jamais faire échouer tout le
    // batchUpdate à cause d'un seul paragraphe vide.
    const text = baseText({
      paragraphs: [
        { start: 0, end: 5, align: 'START' },
        { start: 5, end: 5, align: 'START', bullet: 'UNORDERED' },
      ],
    });
    const reqs = mapText(text, 'page1', 1, 0, 0, UNCALIBRATED_DEFAULTS);
    const paragraphStyleReqs = reqs.filter((r) => 'updateParagraphStyle' in r) as any[];
    expect(paragraphStyleReqs).toHaveLength(1);
    expect(paragraphStyleReqs[0].updateParagraphStyle.textRange).toEqual({ type: 'FIXED_RANGE', startIndex: 0, endIndex: 5 });
    expect(reqs.some((r) => 'createParagraphBullets' in r)).toBe(false);
  });

  it('always sets autofit NONE (spec §3.5 — géré nous-mêmes)', () => {
    const reqs = mapText(baseText(), 'page1', 1, 0, 0, UNCALIBRATED_DEFAULTS);
    const propsReq = reqs.find((r) => 'updateShapeProperties' in r) as any;
    expect(propsReq.updateShapeProperties.shapeProperties.autofit.autofitType).toBe('NONE');
  });
});
