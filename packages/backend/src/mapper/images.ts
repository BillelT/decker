import type { IRImage } from '@figma-to-slides/shared';
import { pt, rotatedTransform } from './transform.js';
import type { SlidesRequest } from './slidesRequests.js';

/**
 * Spec §2.3, §6 — l'`assetKey` a déjà été résolu en URL publique signée
 * (§5.3) avant d'atteindre le mapper ; le mapper ne connaît pas le stockage.
 */
// Spec §11 — Slides refuse un `createImage` dont une dimension est nulle ou
// négative ("A size dimension of a page element must be positive"). Un
// contenu dont la boîte Figma est dégénérée sur un axe (p. ex. une LINE)
// doit rester exportable plutôt que de faire échouer tout le batch de la
// slide — ce plancher est une dernière garde, la vraie taille venant déjà
// de `absoluteRenderBounds` côté plugin (voir serializeFrame.ts).
const MIN_IMAGE_SIZE_PT = 1;

export function mapImage(
  image: IRImage,
  url: string,
  pageObjectId: string,
  scale: number,
  offsetX: number,
  offsetY: number,
): SlidesRequest[] {
  const wPt = Math.max(image.rect.w * scale, MIN_IMAGE_SIZE_PT);
  const hPt = Math.max(image.rect.h * scale, MIN_IMAGE_SIZE_PT);
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
