import { describe, expect, it } from 'vitest';
import type { IRLine } from '@figma-to-slides/shared';
import { mapLine } from './lines.js';

function baseLine(overrides: Partial<IRLine> = {}): IRLine {
  return {
    kind: 'line',
    id: 'f2s_job1_1',
    sourceNodeId: 'node1',
    rect: { x: 10, y: 20, w: 100, h: 0 },
    rotation: 0,
    opacity: 1,
    stroke: { color: { r: 0, g: 0, b: 0, a: 1 }, weightPt: 2, dash: 'SOLID' },
    ...overrides,
  };
}

describe('mapLine', () => {
  it('emits createLine (STRAIGHT) with scaled/offset geometry', () => {
    const [createReq] = mapLine(baseLine(), 'page1', 2, 5, 0);
    expect(createReq).toMatchObject({
      createLine: {
        objectId: 'f2s_job1_1',
        lineCategory: 'STRAIGHT',
        elementProperties: {
          pageObjectId: 'page1',
          size: { width: { magnitude: 200, unit: 'PT' }, height: { magnitude: 0, unit: 'PT' } },
          transform: { translateX: 25, translateY: 40, scaleX: 1, scaleY: 1 },
        },
      },
    });
  });

  it('maps stroke color/weight/dash into updateLineProperties', () => {
    const line = baseLine({ stroke: { color: { r: 1, g: 0, b: 0, a: 1 }, weightPt: 3, dash: 'DASH' } });
    const reqs = mapLine(line, 'page1', 1, 0, 0);
    const update = reqs.find((r) => 'updateLineProperties' in r) as any;
    expect(update.updateLineProperties.lineProperties).toMatchObject({
      lineFill: { solidFill: { color: { rgbColor: { red: 1, green: 0, blue: 0 } }, alpha: 1 } },
      weight: { magnitude: 3, unit: 'PT' },
      dashStyle: 'DASH',
    });
  });

  it('combines stroke alpha with node opacity', () => {
    const line = baseLine({ stroke: { color: { r: 0, g: 0, b: 0, a: 0.5 }, weightPt: 1, dash: 'SOLID' }, opacity: 0.5 });
    const reqs = mapLine(line, 'page1', 1, 0, 0);
    const update = reqs.find((r) => 'updateLineProperties' in r) as any;
    expect(update.updateLineProperties.lineProperties.lineFill.solidFill.alpha).toBe(0.25);
  });
});
