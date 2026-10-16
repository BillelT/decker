import type { CalibrationData, IRDocument, IRSlide } from '@figma-to-slides/shared';
import { toSolidFill } from './colors.js';
import { computeScale, pt, identityTransform } from './transform.js';
import { mapShape } from './shapes.js';
import { mapText } from './text.js';
import { mapImage } from './images.js';
import { mapLine } from './lines.js';
import { mapPlaceholderAltText } from './placeholder.js';
import { mapThemeBatch } from './theme.js';
import type { RequestBatch, SlidesRequest } from './slidesRequests.js';
import { mapSlideOntoLayout, type LayoutAssignment, type NativeLayout } from './templateLayouts.js';

export * from './slidesRequests.js';
export { computeScale, roundForSerialization } from './transform.js';
export { mapThemeBatch, THEME_BATCH_SOURCE_ID } from './theme.js';
export { planTemplateLayouts, type LayoutAssignment, type NativeLayout } from './templateLayouts.js';

/** Mode template : layouts natifs de la présentation et layout choisi pour chaque frame (voir templateLayouts.ts). */
export interface TemplateLayoutContext {
  layouts: NativeLayout[];
  plan: Record<string, LayoutAssignment>;
}

const MAX_REQUESTS_PER_BATCH = 300;

/**
 * Résout un `assetKey` (IRImage / IRUnderlay) vers l'URL publique signée
 * générée par le stockage éphémère (§5.3). Fourni par l'appelant.
 */
export type AssetUrlResolver = (assetKey: string) => string;

/**
 * Spec §6, §5.4 — IRDocument → lots de requêtes `batchUpdate`, un lot par
 * slide au minimum (jamais scindé), triés dans l'ordre de `slides` (déjà
 * trié par `order` côté plugin/UI).
 *
 * `masterObjectId` (audit 2026-08, mode template) n'est connu qu'après la
 * création de la présentation (`slides/client.ts`), donc fourni par
 * l'appelant plutôt que porté par `doc` — si `doc.theme` est présent ET
 * que `masterObjectId` est fourni, le lot d'écriture du thème est
 * préfixé en tête (avant toute slide, pour que les éléments liés à un
 * rôle de thème affichent la bonne couleur dès leur création).
 */
export function mapDocumentToBatches(
  doc: IRDocument,
  resolveAssetUrl: AssetUrlResolver,
  calibration: CalibrationData,
  masterObjectId?: string,
  templateLayouts?: TemplateLayoutContext,
): RequestBatch[] {
  const layoutById = new Map(templateLayouts?.layouts.map((l) => [l.objectId, l]));
  const slideBatches = [...doc.slides]
    .sort((a, b) => a.order - b.order)
    .map((slide) => {
      const assignment = templateLayouts?.plan[slide.sourceNodeId];
      const layout = assignment && layoutById.get(assignment.layoutId);
      return assignment && layout
        ? mapSlideOntoLayout(slide, doc, assignment, layout, resolveAssetUrl, calibration)
        : mapSlide(slide, doc, resolveAssetUrl, calibration);
    });
  if (doc.theme && masterObjectId) {
    return [mapThemeBatch(doc.theme, masterObjectId), ...slideBatches];
  }
  return slideBatches;
}

function mapSlide(
  slide: IRSlide,
  doc: IRDocument,
  resolveAssetUrl: AssetUrlResolver,
  calibration: CalibrationData,
): RequestBatch {
  const pageObjectId = `f2s_page_${slide.sourceNodeId}`;
  const { scale, offsetXPt, offsetYPt } = computeScale(slide.frameSize, doc.slideSize);

  const requests: SlidesRequest[] = [{ createSlide: { objectId: pageObjectId } }];

  // §2.4 RÈGLE z-order : ordre de création = ordre d'empilement, arrière → avant.
  // §7.1 RÈGLE z-order : l'underlay est créé en tout premier (le plus en arrière).
  if (slide.underlay) {
    requests.push(...mapUnderlay(slide, pageObjectId, resolveAssetUrl(slide.underlay.assetKey), scale, offsetXPt, offsetYPt));
  }

  if (slide.background) {
    requests.push(...mapBackground(slide, pageObjectId));
  }

  for (const el of slide.elements) {
    switch (el.kind) {
      case 'shape':
        requests.push(...mapShape(el, pageObjectId, scale, offsetXPt, offsetYPt));
        break;
      case 'text':
        requests.push(...mapText(el, pageObjectId, scale, offsetXPt, offsetYPt, calibration));
        break;
      case 'image':
        requests.push(...mapImage(el, resolveAssetUrl(el.assetKey), pageObjectId, scale, offsetXPt, offsetYPt));
        break;
      case 'line':
        requests.push(...mapLine(el, pageObjectId, scale, offsetXPt, offsetYPt));
        break;
    }
    // Toujours après la création/le style de l'élément lui-même : l'alt
    // text s'applique à un objectId qui doit déjà exister dans ce batch.
    if (el.placeholder) {
      requests.push({ updatePageElementAltText: mapPlaceholderAltText(el.id, el.placeholder) });
    }
  }

  if (requests.length > MAX_REQUESTS_PER_BATCH) {
    // Spec §5.4 : une slide = un lot indivisible, même au-delà de 300 requêtes.
    // On dépasse volontairement le seuil recommandé plutôt que de fragmenter
    // une slide ; à surveiller si l'API le rejette en pratique.
    // eslint-disable-next-line no-console
    console.warn(
      `[mapper] slide ${slide.sourceNodeId} génère ${requests.length} requêtes (> ${MAX_REQUESTS_PER_BATCH}), envoyée en un seul lot quand même.`,
    );
  }

  return { sourceSlideId: slide.sourceNodeId, requests };
}

function mapUnderlay(
  slide: IRSlide,
  pageObjectId: string,
  url: string,
  scale: number,
  offsetX: number,
  offsetY: number,
): SlidesRequest[] {
  const wPt = slide.frameSize.width * scale;
  const hPt = slide.frameSize.height * scale;
  const objectId = `f2s_${slide.sourceNodeId}_underlay_0`;
  return [
    {
      createImage: {
        objectId,
        url,
        elementProperties: {
          pageObjectId,
          size: { width: pt(wPt), height: pt(hPt) },
          transform: identityTransform(offsetX, offsetY),
        },
      },
    },
  ];
}

/**
 * Fond uni de la frame Figma, écrit comme vrai fond de page Slides
 * (`pageBackgroundFill`) et non plus comme un rectangle plein cadre posé
 * sous le contenu. Deux raisons :
 * 1. l'utilisateur le change depuis "Background" dans Slides, au lieu de
 *    tomber sur un rectangle verrouillé à sélectionner par erreur ;
 * 2. Slides peint les éléments du Master et du layout ENTRE le fond de la
 *    page et son contenu : un rectangle plein cadre les masquait, ce qui
 *    rendait impossible tout élément récurrent écrit sur le Master
 *    (TODO.md § Mode template, point 3).
 * Le fond couvre toute la page, bandes de letterbox comprises.
 */
function mapBackground(slide: IRSlide, pageObjectId: string): SlidesRequest[] {
  if (!slide.background) return [];
  return [
    {
      updatePageProperties: {
        objectId: pageObjectId,
        pageProperties: { pageBackgroundFill: { solidFill: toSolidFill(slide.background.color) } },
        fields: 'pageBackgroundFill',
      },
    },
  ];
}

/**
 * Spec §5.4 RÈGLE — regroupe des lots par slide en batchs `batchUpdate`
 * d'au plus `MAX_REQUESTS_PER_BATCH` requêtes, sans jamais scinder une
 * slide entre deux appels.
 */
export function chunkBatchesForApi(batches: RequestBatch[], maxPerCall = MAX_REQUESTS_PER_BATCH): RequestBatch[][] {
  const calls: RequestBatch[][] = [];
  let current: RequestBatch[] = [];
  let currentCount = 0;

  for (const batch of batches) {
    if (current.length > 0 && currentCount + batch.requests.length > maxPerCall) {
      calls.push(current);
      current = [];
      currentCount = 0;
    }
    current.push(batch);
    currentCount += batch.requests.length;
  }
  if (current.length > 0) calls.push(current);
  return calls;
}
