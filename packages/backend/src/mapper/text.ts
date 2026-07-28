import type { CalibrationData, IRParagraph, IRText, IRTextRun } from '@figma-to-slides/shared';
import { toOpaqueColor } from './colors.js';
import { applyTextInset, pt, rotatedTransform } from './transform.js';
import type { SlidesRequest, TextRange, TextStyle, ParagraphStyle } from './slidesRequests.js';

/**
 * Spec §3.5, §6, §11.7-8 — un IRText devient : createShape(TEXT_BOX) →
 * insertText → updateTextStyle (par run) → updateParagraphStyle (par
 * paragraphe) → createParagraphBullets (si liste). L'ORDRE DU TABLEAU fait
 * foi dans un batchUpdate : insertText doit précéder tout style qui
 * référence ses indices (piège §11.7). Les indices sont en UTF-16 (§11.8),
 * ce qui correspond à `.length` en JS — ne pas "corriger".
 */
export function mapText(
  text: IRText,
  pageObjectId: string,
  scale: number,
  offsetX: number,
  offsetY: number,
  calibration: CalibrationData,
): SlidesRequest[] {
  const insetPx = {
    left: calibration.textInset.left / scale,
    right: calibration.textInset.right / scale,
    top: calibration.textInset.top / scale,
    bottom: calibration.textInset.bottom / scale,
  };
  const box = applyTextInset(text.rect, insetPx);

  // Absorbe l'écart de rendu de police Figma ↔ Slides (voir CalibrationData
  // — sans ça, un texte à largeur ajustée pile sur son contenu retourne à la
  // ligne de façon inattendue, faute de la moindre marge). Basée sur le plus
  // grand run pour couvrir le caractère le plus large du texte.
  const maxFontSizePx = text.runs.reduce((max, run) => Math.max(max, run.fontSizePx), 0);
  // Une police substituée (originalFontFamily défini, cf. fonts.ts côté
  // plugin) a des métriques de caractère différentes de la police d'origine
  // — la marge calibrée sur les polices d'origine ne suffit pas toujours,
  // d'où des retours à la ligne inattendus une fois substituée. On triple
  // la marge dans ce cas pour réduire ce risque.
  const hasSubstitutedFont = text.runs.some((run) => run.originalFontFamily !== undefined);
  const marginEm = hasSubstitutedFont ? calibration.textWidthSafetyMarginEm * 3 : calibration.textWidthSafetyMarginEm;
  const widthSafetyMarginPt = maxFontSizePx * scale * marginEm;

  const wPt = box.w * scale + widthSafetyMarginPt;
  const hPt = box.h * scale;
  const xPt = box.x * scale + offsetX;
  const yPt = box.y * scale + offsetY;

  const requests: SlidesRequest[] = [
    {
      createShape: {
        objectId: text.id,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId,
          size: { width: pt(wPt), height: pt(hPt) },
          transform: rotatedTransform(xPt, yPt, wPt, hPt, text.rotation),
        },
      },
    },
    {
      updateShapeProperties: {
        objectId: text.id,
        shapeProperties: {
          contentAlignment: text.vAlign,
          autofit: { autofitType: 'NONE' },
          outline: { propertyState: 'NOT_RENDERED' },
        },
        fields: 'contentAlignment,autofit.autofitType,outline.propertyState',
      },
    },
  ];

  if (text.content.length === 0) return requests;

  requests.push({ insertText: { objectId: text.id, text: text.content, insertionIndex: 0 } });

  for (const run of text.runs) {
    requests.push(mapTextRunStyle(text.id, run, scale));
  }

  for (const para of text.paragraphs) {
    // Garde-fou : la Slides API rejette tout textRange avec
    // startIndex >= endIndex ("must be less than endIndex", 400). Un
    // paragraphe vide ne devrait normalement plus être émis par le plugin
    // (voir textExtract.ts côté plugin), mais on ne veut pas qu'un cas non
    // prévu ici fasse échouer tout le batchUpdate — donc tout le reste de
    // l'export — pour un seul paragraphe sans rien à styler.
    if (para.start >= para.end) continue;
    requests.push(mapParagraphStyle(text.id, para));
    if (para.bullet) {
      requests.push({
        createParagraphBullets: {
          objectId: text.id,
          textRange: fixedRange(para.start, para.end),
          bulletPreset: para.bullet === 'UNORDERED' ? 'BULLET_DISC_CIRCLE_SQUARE' : 'NUMBERED_DIGIT_ALPHA_ROMAN',
        },
      });
    }
  }

  return requests;
}

function fixedRange(start: number, end: number): TextRange {
  return { type: 'FIXED_RANGE', startIndex: start, endIndex: end };
}

function mapTextRunStyle(objectId: string, run: IRTextRun, scale: number): SlidesRequest {
  const style: TextStyle = {
    italic: run.italic,
    // Spec §3.5 — "la police suit le même facteur que la géométrie".
    fontSize: pt(run.fontSizePx * scale),
    weightedFontFamily: { fontFamily: run.fontFamily, weight: run.fontWeight },
    foregroundColor: { opaqueColor: toOpaqueColor(run.color) },
  };
  const fields = ['italic', 'fontSize', 'weightedFontFamily', 'foregroundColor'];

  if (run.underline !== undefined) {
    style.underline = run.underline;
    fields.push('underline');
  }
  if (run.strikethrough !== undefined) {
    style.strikethrough = run.strikethrough;
    fields.push('strikethrough');
  }
  if (run.smallCaps !== undefined) {
    style.smallCaps = run.smallCaps;
    fields.push('smallCaps');
  }
  if (run.link) {
    style.link = { url: run.link };
    fields.push('link');
  }

  return {
    updateTextStyle: {
      objectId,
      textRange: fixedRange(run.start, run.end),
      style,
      fields: fields.join(','),
    },
  };
}

function mapParagraphStyle(objectId: string, para: IRParagraph): SlidesRequest {
  const style: ParagraphStyle = { alignment: para.align };
  const fields = ['alignment'];

  if (para.lineSpacingPct !== undefined) {
    style.lineSpacing = para.lineSpacingPct;
    fields.push('lineSpacing');
  }
  if (para.spaceAbovePt !== undefined) {
    style.spaceAbove = pt(para.spaceAbovePt);
    fields.push('spaceAbove');
  }
  if (para.spaceBelowPt !== undefined) {
    style.spaceBelow = pt(para.spaceBelowPt);
    fields.push('spaceBelow');
  }
  if (para.indentStartPt !== undefined) {
    style.indentStart = pt(para.indentStartPt);
    fields.push('indentStart');
  }

  return {
    updateParagraphStyle: {
      objectId,
      textRange: fixedRange(para.start, para.end),
      style,
      fields: fields.join(','),
    },
  };
}
