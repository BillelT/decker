import { describe, expect, it } from 'vitest';
import type { IRShape } from '@figma-to-slides/shared';
import { mapShape } from './shapes.js';

function baseShape(overrides: Partial<IRShape> = {}): IRShape {
  return {
    kind: 'shape',
    id: 'f2s_job1_1',
    sourceNodeId: 'node1',
    rect: { x: 10, y: 20, w: 100, h: 50 },
    rotation: 0,
    opacity: 1,
    shapeType: 'RECTANGLE',
    ...overrides,
  };
}

describe('mapShape', () => {
  it('emits createShape with scaled/offset geometry', () => {
    const [createReq] = mapShape(baseShape(), 'page1', 2, 5, 0);
    expect(createReq).toMatchObject({
      createShape: {
        objectId: 'f2s_job1_1',
        shapeType: 'RECTANGLE',
        elementProperties: {
          pageObjectId: 'page1',
          size: { width: { magnitude: 200, unit: 'PT' }, height: { magnitude: 100, unit: 'PT' } },
          transform: { translateX: 25, translateY: 40, scaleX: 1, scaleY: 1 },
        },
      },
    });
  });

  it('forces outline.propertyState NOT_RENDERED when Figma has no stroke (piège §11.5)', () => {
    const reqs = mapShape(baseShape(), 'page1', 1, 0, 0);
    const update = reqs.find((r) => 'updateShapeProperties' in r);
    expect(update).toMatchObject({
      updateShapeProperties: { shapeProperties: { outline: { propertyState: 'NOT_RENDERED' } } },
    });
  });

  it('maps fill color with combined alpha', () => {
    const shape = baseShape({ fill: { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 0.5 } }, opacity: 0.5 });
    const reqs = mapShape(shape, 'page1', 1, 0, 0);
    const update = reqs.find((r) => 'updateShapeProperties' in r) as any;
    expect(update.updateShapeProperties.shapeProperties.shapeBackgroundFill.solidFill).toEqual({
      color: { rgbColor: { red: 1, green: 0, blue: 0 } },
      alpha: 0.25,
    });
  });

  it('maps an explicit stroke', () => {
    const shape = baseShape({ stroke: { color: { r: 0, g: 0, b: 0, a: 1 }, weightPt: 2, dash: 'SOLID' } });
    const reqs = mapShape(shape, 'page1', 1, 0, 0);
    const update = reqs.find((r) => 'updateShapeProperties' in r) as any;
    expect(update.updateShapeProperties.shapeProperties.outline).toMatchObject({
      weight: { magnitude: 2, unit: 'PT' },
      dashStyle: 'SOLID',
      propertyState: 'RENDERED',
    });
  });

  it('maps TEXT_BOX shapeType down to RECTANGLE for non-text shapes reusing the enum', () => {
    const shape = baseShape({ shapeType: 'TEXT_BOX' });
    const [createReq] = mapShape(shape, 'page1', 1, 0, 0) as any;
    expect(createReq.createShape.shapeType).toBe('RECTANGLE');
  });
});
