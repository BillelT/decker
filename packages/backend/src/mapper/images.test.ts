import { describe, expect, it } from 'vitest';
import type { IRImage } from '@figma-to-slides/shared';
import { mapImage } from './images.js';

function baseImage(overrides: Partial<IRImage> = {}): IRImage {
  return {
    kind: 'image',
    id: 'f2s_job1_3',
    sourceNodeId: 'node3',
    rect: { x: 0, y: 0, w: 50, h: 50 },
    rotation: 0,
    opacity: 1,
    assetKey: 'asset-1',
    isRasterFallback: false,
    ...overrides,
  };
}

describe('mapImage', () => {
  it('emits a single createImage using the resolved URL, not the assetKey', () => {
    const reqs = mapImage(baseImage(), 'https://cdn.example.com/asset-1.png', 'page1', 1, 0, 0);
    expect(reqs).toHaveLength(1);
    expect(reqs[0]).toMatchObject({
      createImage: {
        objectId: 'f2s_job1_3',
        url: 'https://cdn.example.com/asset-1.png',
        elementProperties: { pageObjectId: 'page1' },
      },
    });
  });
});
