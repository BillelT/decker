import type { SlidesRequest } from '../../mapper/index.js';
import { pt, identityTransform } from '../../mapper/transform.js';

/**
 * Fixture `03-text-inset` (spec §4 : « textInset — mesure : boîte à fond
 * coloré + texte connu, on compare la position du glyphe »). Contrairement
 * à `01-rects`, on ne passe PAS par `mapDocumentToBatches`/`mapText` : celui-
 * ci COMPENSE déjà `calibration.textInset` (`applyTextInset`) pour que le
 * texte tombe au bon endroit — l'utiliser ici mesurerait la valeur par
 * défaut qu'on cherche justement à remplacer, pas la vraie marge interne de
 * Slides. Ces requêtes sont donc construites à la main, sur une géométrie
 * connue et non compensée.
 *
 * Deux boîtes, sur la même slide 720×405pt (échelle 1:1, comme `01-rects`) :
 * - "top-left" : texte ancré haut-gauche → mesure l'inset gauche + haut.
 * - "bottom-right" : texte ancré bas-droite → mesure l'inset droit + bas.
 * Fond gris clair distinct du blanc de la slide (pour repérer les bords de
 * la boîte) et texte rouge gras (fort contraste, glyphe "H" — trait vertical
 * net à gauche, sommet plat, pas de empattement) pour une détection de bord
 * fiable par balayage de pixels (voir pixelMeasure.ts).
 */

export const PAGE_OBJECT_ID = 'f2s_calib_textinset_page';
export const SLIDE_SIZE = { widthPt: 720, heightPt: 405 };

export const BG_COLOR = { red: 0.82, green: 0.82, blue: 0.82 };
export const TEXT_COLOR = { red: 0.85, green: 0.1, blue: 0.1 };
export const FONT_SIZE_PT = 40;
export const GLYPH = 'H';

export const TOP_LEFT_BOX = { objectId: 'f2s_calib_probe_tl', rect: { x: 60, y: 60, w: 280, h: 140 } };
export const BOTTOM_RIGHT_BOX = { objectId: 'f2s_calib_probe_br', rect: { x: 380, y: 200, w: 280, h: 140 } };

function probeRequests(
  objectId: string,
  rect: { x: number; y: number; w: number; h: number },
  vAlign: 'TOP' | 'BOTTOM',
  align: 'START' | 'END',
): SlidesRequest[] {
  const textRange = { type: 'FIXED_RANGE' as const, startIndex: 0, endIndex: GLYPH.length };
  return [
    {
      createShape: {
        objectId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: PAGE_OBJECT_ID,
          size: { width: pt(rect.w), height: pt(rect.h) },
          transform: identityTransform(rect.x, rect.y),
        },
      },
    },
    {
      updateShapeProperties: {
        objectId,
        shapeProperties: {
          contentAlignment: vAlign,
          autofit: { autofitType: 'NONE' },
          outline: { propertyState: 'NOT_RENDERED' },
          shapeBackgroundFill: { solidFill: { color: { rgbColor: BG_COLOR }, alpha: 1 } },
        },
        fields: 'contentAlignment,autofit.autofitType,outline.propertyState,shapeBackgroundFill.solidFill',
      },
    },
    { insertText: { objectId, text: GLYPH, insertionIndex: 0 } },
    {
      updateTextStyle: {
        objectId,
        textRange,
        style: {
          fontSize: pt(FONT_SIZE_PT),
          weightedFontFamily: { fontFamily: 'Arial', weight: 700 },
          foregroundColor: { opaqueColor: { rgbColor: TEXT_COLOR } },
        },
        fields: 'fontSize,weightedFontFamily,foregroundColor',
      },
    },
    {
      updateParagraphStyle: {
        objectId,
        textRange,
        style: { alignment: align },
        fields: 'alignment',
      },
    },
  ];
}

export function buildTextInsetProbeRequests(): SlidesRequest[] {
  return [
    { createSlide: { objectId: PAGE_OBJECT_ID } },
    ...probeRequests(TOP_LEFT_BOX.objectId, TOP_LEFT_BOX.rect, 'TOP', 'START'),
    ...probeRequests(BOTTOM_RIGHT_BOX.objectId, BOTTOM_RIGHT_BOX.rect, 'BOTTOM', 'END'),
  ];
}
