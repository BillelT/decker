import type { IRImage } from '@figma-to-slides/shared';
import { pt, rotatedTransform } from './transform.js';
import type { SlidesRequest } from './slidesRequests.js';

/**
 * Spec §2.3, §6 — l'`assetKey` a déjà été résolu en URL publique signée
 * (§5.3) avant d'atteindre le mapper ; le mapper ne connaît pas le stockage.
 */
export function mapImage(
  image: IRImage,
  url: string,
  pageObjectId: string,
  scale: number,
  offsetX: number,
  offsetY: number,
): SlidesRequest[] {
  const wPt = image.rect.w * scale;
  const hPt = image.rect.h * scale;
  const xPt = image.rect.x * scale + offsetX;
  const yPt = image.rect.y * scale + offsetY;

  return [
    {
      createImage: {
        objectId: image.id,
        url,
        elementProperties: {
          pageObjectId,
          size: { width: pt(wPt), height: pt(hPt) },
          transform: rotatedTransform(xPt, yPt, wPt, hPt, image.rotation),
        },
      },
    },
  ];
}
