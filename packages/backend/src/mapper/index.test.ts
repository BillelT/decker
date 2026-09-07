import { describe, expect, it } from 'vitest';
import type { IRDocument, IRSlide } from '@figma-to-slides/shared';
import { UNCALIBRATED_DEFAULTS } from '@figma-to-slides/shared';
import { chunkBatchesForApi, mapDocumentToBatches } from './index.js';
import type { RequestBatch } from './slidesRequests.js';

function baseSlide(overrides: Partial<IRSlide> = {}): IRSlide {
  return {
    sourceNodeId: 'frame1',
    frameName: 'Frame 1',
    order: 0,
    frameSize: { width: 720, height: 405 },
    elements: [],
    warnings: [],
    previewDataUrl: '',
    ...overrides,
  };
}

function baseDoc(slides: IRSlide[]): IRDocument {
  return {
    version: 1,
    presentationTitle: 'Test deck',
    slideSize: { widthPt: 720, heightPt: 405 },
    slides,
    options: {
      mode: 'new-presentation',
      rasterScale: 2,
      includeUnderlay: false,
      underlayOpacity: 0.3,
      strictMode: false,
    },
  };
}

describe('mapDocumentToBatches', () => {
  it('produces one batch per slide, ordered by IRSlide.order', () => {
    const doc = baseDoc([baseSlide({ sourceNodeId: 'b', order: 1 }), baseSlide({ sourceNodeId: 'a', order: 0 })]);
    const batches = mapDocumentToBatches(doc, () => '', UNCALIBRATED_DEFAULTS);
    expect(batches.map((b) => b.sourceSlideId)).toEqual(['a', 'b']);
  });

  it('starts every slide batch with createSlide', () => {
    const doc = baseDoc([baseSlide()]);
    const [batch] = mapDocumentToBatches(doc, () => '', UNCALIBRATED_DEFAULTS);
    expect(Object.keys(batch.requests[0])[0]).toBe('createSlide');
  });

  it('creates the underlay before the background before regular elements (spec §2.4 + §7.1)', () => {
    const doc = baseDoc([
      baseSlide({
        underlay: { assetKey: 'underlay-1', opacity: 0.3 },
        background: { type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } },
        elements: [
          {
            kind: 'shape',
            id: 'el1',
            sourceNodeId: 'n1',
            rect: { x: 0, y: 0, w: 10, h: 10 },
            rotation: 0,
            opacity: 1,
            shapeType: 'RECTANGLE',
          },
        ],
      }),
    ]);
    const [batch] = mapDocumentToBatches(doc, (key) => `https://cdn/${key}`, UNCALIBRATED_DEFAULTS);
    const createImageIdx = batch.requests.findIndex((r) => 'createImage' in r);
    const backgroundIdx = batch.requests.findIndex(
      (r) => 'createShape' in r && (r as any).createShape.objectId.endsWith('_background'),
    );
    const elementIdx = batch.requests.findIndex((r) => 'createShape' in r && (r as any).createShape.objectId === 'el1');

    expect(createImageIdx).toBeGreaterThan(-1);
    expect(createImageIdx).toBeLessThan(backgroundIdx);
    expect(backgroundIdx).toBeLessThan(elementIdx);
  });

  it('resolves image assetKeys through the provided resolver', () => {
    const doc = baseDoc([
      baseSlide({
        elements: [
          {
            kind: 'image',
            id: 'img1',
            sourceNodeId: 'n2',
            rect: { x: 0, y: 0, w: 10, h: 10 },
            rotation: 0,
            opacity: 1,
            assetKey: 'my-asset',
            isRasterFallback: false,
          },
        ],
      }),
    ]);
    const [batch] = mapDocumentToBatches(doc, (key) => `https://cdn/${key}.png`, UNCALIBRATED_DEFAULTS);
    const imageReq = batch.requests.find((r) => 'createImage' in r) as any;
    expect(imageReq.createImage.url).toBe('https://cdn/my-asset.png');
  });

  it('emits an updatePageElementAltText request after an element carrying placeholder metadata', () => {
    const doc = baseDoc([
      baseSlide({
        elements: [
          {
            kind: 'shape',
            id: 'el1',
            sourceNodeId: 'n1',
            rect: { x: 0, y: 0, w: 10, h: 10 },
            rotation: 0,
            opacity: 1,
            shapeType: 'RECTANGLE',
            placeholder: { role: 'IMAGE', label: 'Hero photo' },
          },
        ],
      }),
    ]);
    const [batch] = mapDocumentToBatches(doc, () => '', UNCALIBRATED_DEFAULTS);
    const shapeIdx = batch.requests.findIndex((r) => 'createShape' in r && (r as any).createShape.objectId === 'el1');
    const altTextIdx = batch.requests.findIndex((r) => 'updatePageElementAltText' in r);
    expect(altTextIdx).toBeGreaterThan(shapeIdx);
    expect((batch.requests[altTextIdx] as any).updatePageElementAltText).toEqual({
      objectId: 'el1',
      title: 'Template placeholder: Hero photo',
      description: 'f2s-placeholder:IMAGE',
    });
  });

  it('does not emit an alt text request for elements without placeholder metadata', () => {
    const doc = baseDoc([
      baseSlide({
        elements: [
          { kind: 'shape', id: 'el1', sourceNodeId: 'n1', rect: { x: 0, y: 0, w: 10, h: 10 }, rotation: 0, opacity: 1, shapeType: 'RECTANGLE' },
        ],
      }),
    ]);
    const [batch] = mapDocumentToBatches(doc, () => '', UNCALIBRATED_DEFAULTS);
    expect(batch.requests.some((r) => 'updatePageElementAltText' in r)).toBe(false);
  });

  it('dispatches line elements to createLine rather than createShape/createImage', () => {
    const doc = baseDoc([
      baseSlide({
        elements: [
          {
            kind: 'line',
            id: 'line1',
            sourceNodeId: 'n3',
            rect: { x: 0, y: 0, w: 100, h: 0 },
            rotation: 0,
            opacity: 1,
            stroke: { color: { r: 0, g: 0, b: 0, a: 1 }, weightPt: 1, dash: 'SOLID' },
          },
        ],
      }),
    ]);
    const [batch] = mapDocumentToBatches(doc, () => '', UNCALIBRATED_DEFAULTS);
    const lineReq = batch.requests.find((r) => 'createLine' in r) as any;
    expect(lineReq.createLine.objectId).toBe('line1');
    expect(lineReq.createLine.lineCategory).toBe('STRAIGHT');
  });

  describe('theme batch (audit 2026-08, mode template)', () => {
    const THEME: IRDocument['theme'] = {
      DARK1: { r: 0.1, g: 0.1, b: 0.18 },
      LIGHT1: { r: 1, g: 1, b: 1 },
      DARK2: { r: 0.09, g: 0.13, b: 0.24 },
      LIGHT2: { r: 0.96, g: 0.96, b: 0.96 },
      ACCENT1: { r: 1, g: 0.42, b: 0 },
      ACCENT2: { r: 0, g: 0.7, b: 0.85 },
      ACCENT3: { r: 0.48, g: 0.17, b: 0.75 },
      ACCENT4: { r: 0.02, g: 0.84, b: 0.63 },
      ACCENT5: { r: 1, g: 0.84, b: 0.04 },
      ACCENT6: { r: 0.94, g: 0.28, b: 0.44 },
      HYPERLINK: { r: 0.11, g: 0.6, b: 0.67 },
      FOLLOWED_HYPERLINK: { r: 0.42, g: 0.3, b: 0.58 },
    };

    it('prepends the theme batch before any slide when both doc.theme and masterObjectId are given', () => {
      const doc = { ...baseDoc([baseSlide()]), theme: THEME };
      const batches = mapDocumentToBatches(doc, () => '', UNCALIBRATED_DEFAULTS, 'master1');
      expect(batches[0].sourceSlideId).toBe('__theme__');
      expect(batches[1].sourceSlideId).toBe('frame1');
    });

    it('omits the theme batch when doc.theme is absent, even with a masterObjectId (plain deck export)', () => {
      const doc = baseDoc([baseSlide()]);
      const batches = mapDocumentToBatches(doc, () => '', UNCALIBRATED_DEFAULTS, 'master1');
      expect(batches.map((b) => b.sourceSlideId)).toEqual(['frame1']);
    });

    it('omits the theme batch when masterObjectId is missing, even with doc.theme set (append-to-existing has no fresh Master to target)', () => {
      const doc = { ...baseDoc([baseSlide()]), theme: THEME };
      const batches = mapDocumentToBatches(doc, () => '', UNCALIBRATED_DEFAULTS);
      expect(batches.map((b) => b.sourceSlideId)).toEqual(['frame1']);
    });
  });
});

describe('chunkBatchesForApi', () => {
  function fakeBatch(id: string, requestCount: number): RequestBatch {
    return { sourceSlideId: id, requests: Array.from({ length: requestCount }, () => ({ createSlide: { objectId: id } })) };
  }

  it('groups small slide batches together under the request cap', () => {
    const batches = [fakeBatch('a', 100), fakeBatch('b', 100), fakeBatch('c', 100)];
    const calls = chunkBatchesForApi(batches, 250);
    expect(calls).toHaveLength(2);
    expect(calls[0].map((b) => b.sourceSlideId)).toEqual(['a', 'b']);
    expect(calls[1].map((b) => b.sourceSlideId)).toEqual(['c']);
  });

  it('never splits a single slide across two calls, even oversized (spec §5.4)', () => {
    const batches = [fakeBatch('a', 10), fakeBatch('big', 400)];
    const calls = chunkBatchesForApi(batches, 300);
    const bigCall = calls.find((call) => call.some((b) => b.sourceSlideId === 'big'));
    expect(bigCall).toHaveLength(1);
    expect(bigCall![0].requests).toHaveLength(400);
  });
});
