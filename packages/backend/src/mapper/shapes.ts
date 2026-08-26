import type { IRShape } from '@figma-to-slides/shared';
import { toSolidFill, combinedAlpha } from './colors.js';
import { pt, rotatedTransform } from './transform.js';
import type { SlidesRequest, ShapeProperties } from './slidesRequests.js';

/**
 * Spec §3.2, §6, §11.5/6 — une forme non-texte devient un `createShape` +
 * (optionnellement) `updateShapeProperties` pour le fill/stroke.
 * Une forme sans stroke Figma force `outline.propertyState: NOT_RENDERED`
 * pour éviter d'hériter du contour par défaut du thème (piège §11.5).
 */
export function mapShape(
  shape: IRShape,
  pageObjectId: string,
  scale: number,
  offsetX: number,
  offsetY: number,
): SlidesRequest[] {
  const wPt = shape.rect.w * scale;
  const hPt = shape.rect.h * scale;
  const xPt = shape.rect.x * scale + offsetX;
  const yPt = shape.rect.y * scale + offsetY;

  const requests: SlidesRequest[] = [
    {
      createShape: {
        objectId: shape.id,
        shapeType: shape.shapeType === 'TEXT_BOX' ? 'RECTANGLE' : shape.shapeType,
        elementProperties: {
          pageObjectId,
          size: { width: pt(wPt), height: pt(hPt) },
          transform: rotatedTransform(xPt, yPt, wPt, hPt, shape.rotation, shape.flipped ?? false),
        },
      },
    },
  ];

  const shapeProperties: ShapeProperties = {};
  const fields: string[] = [];

  if (shape.fill) {
    const alpha = combinedAlpha(shape.fill.color.a, shape.opacity);
    shapeProperties.shapeBackgroundFill = { solidFill: { ...toSolidFill(shape.fill.color), alpha } };
    fields.push('shapeBackgroundFill.solidFill');
  }

  if (shape.stroke) {
    shapeProperties.outline = {
      outlineFill: { solidFill: toSolidFill(shape.stroke.color) },
      weight: pt(shape.stroke.weightPt),
      dashStyle: shape.stroke.dash,
      propertyState: 'RENDERED',
    };
    fields.push('outline');
  } else {
    // Piège §11.5 : force l'absence de contour, sinon héritage du thème.
    shapeProperties.outline = { propertyState: 'NOT_RENDERED' };
    fields.push('outline.propertyState');
  }

  if (fields.length > 0) {
    requests.push({
      updateShapeProperties: {
        objectId: shape.id,
        shapeProperties,
        fields: fields.join(','),
      },
    });
  }

  return requests;
}
