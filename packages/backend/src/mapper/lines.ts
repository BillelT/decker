import type { IRLine } from '@figma-to-slides/shared';
import { toSolidFill, combinedAlpha } from './colors.js';
import { pt, rotatedTransform } from './transform.js';
import type { SlidesRequest, LineProperties } from './slidesRequests.js';

/**
 * Une LINE Figma devient un `createLine` (STRAIGHT) + `updateLineProperties`
 * pour la couleur/épaisseur/pointillés — l'équivalent de shapes.ts pour les
 * lignes (anciennement toujours rasterisées, voir LIMITATIONS.md).
 */
export function mapLine(line: IRLine, pageObjectId: string, scale: number, offsetX: number, offsetY: number): SlidesRequest[] {
  const wPt = line.rect.w * scale;
  const hPt = line.rect.h * scale;
  const xPt = line.rect.x * scale + offsetX;
  const yPt = line.rect.y * scale + offsetY;

  const alpha = combinedAlpha(line.stroke.color.a, line.opacity);
  const lineProperties: LineProperties = {
    lineFill: { solidFill: { ...toSolidFill(line.stroke.color), alpha } },
    weight: pt(line.stroke.weightPt),
    dashStyle: line.stroke.dash,
  };

  return [
    {
      createLine: {
        objectId: line.id,
        lineCategory: 'STRAIGHT',
        elementProperties: {
          pageObjectId,
          size: { width: pt(wPt), height: pt(hPt) },
          transform: rotatedTransform(xPt, yPt, wPt, hPt, line.rotation),
        },
      },
    },
    {
      updateLineProperties: {
        objectId: line.id,
        lineProperties,
        fields: 'lineFill.solidFill,weight,dashStyle',
      },
    },
  ];
}
