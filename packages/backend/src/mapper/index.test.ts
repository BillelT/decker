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
      title: 'Template placeholder — Hero photo',
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
