/**
 * Spec §3.5 — mapping des propriétés délicates du texte. Fonctions pures
 * (pas de dépendance à l'API Figma) pour rester testables sans runtime.
 */

export type FigmaTextAlignHorizontal = 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
export type SlidesParagraphAlignment = 'START' | 'CENTER' | 'END' | 'JUSTIFIED';

export function mapAlignment(align: FigmaTextAlignHorizontal): SlidesParagraphAlignment {
  switch (align) {
    case 'LEFT':
      return 'START';
    case 'RIGHT':
      return 'END';
    case 'JUSTIFIED':
      return 'JUSTIFIED';
    case 'CENTER':
    default:
      return 'CENTER';
  }
}

export type FigmaTextAlignVertical = 'TOP' | 'CENTER' | 'BOTTOM';
export type SlidesContentAlignment = 'TOP' | 'MIDDLE' | 'BOTTOM';

export function mapVerticalAlignment(align: FigmaTextAlignVertical): SlidesContentAlignment {
  return align === 'CENTER' ? 'MIDDLE' : align;
}

export type FigmaTextCase = 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE' | 'SMALL_CAPS';

/**
 * Spec §3.5 — Slides n'a pas de text-transform : applique la transformation
 * au contenu lui-même. `SMALL_CAPS` se gère via `textStyle.smallCaps`, pas
 * ici (le contenu textuel reste inchangé pour ce cas).
 */
export function applyTextCase(text: string, textCase: FigmaTextCase): string {
  switch (textCase) {
    case 'UPPER':
      return text.toUpperCase();
    case 'LOWER':
      return text.toLowerCase();
    case 'TITLE':
      return text.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
    case 'SMALL_CAPS':
    case 'ORIGINAL':
    default:
      return text;
  }
}

export type FigmaLineHeight = { unit: 'PIXELS'; value: number } | { unit: 'PERCENT'; value: number } | { unit: 'AUTO' };

/** Spec §3.5 table — lineHeight Figma → lineSpacing Slides (%). `AUTO` → ne pas envoyer le champ. */
export function mapLineSpacing(lineHeight: FigmaLineHeight, fontSizePx: number): number | undefined {
  if (lineHeight.unit === 'AUTO') return undefined;
  if (lineHeight.unit === 'PERCENT') return lineHeight.value;
  return (lineHeight.value / fontSizePx) * 100;
}

/**
 * Spec §3.5 — impact du letterSpacing perdu : Δlargeur = spacing × (nbChars-1).
 * Si Δ/largeur > 2% → raster, sinon ignorer silencieusement mais loguer.
 */
export function letterSpacingImpactRatio(letterSpacingPx: number, charCount: number, measuredWidthPx: number): number {
  if (measuredWidthPx <= 0 || charCount <= 1) return 0;
  const deltaWidth = letterSpacingPx * (charCount - 1);
  return Math.abs(deltaWidth) / measuredWidthPx;
}

export const LETTER_SPACING_RASTER_THRESHOLD = 0.02;

/**
 * Figma encode un retour à la ligne manuel (Maj+Entrée, à l'intérieur d'un
 * même paragraphe) avec le caractère Unicode LINE SEPARATOR (U+2028) —
 * distinct du "\n" d'un vrai saut de paragraphe (Entrée). L'API Slides
 * ignore U+2028 lors d'un `insertText` (le texte se retrouve concaténé sans
 * retour visible, puis re-réparti selon la largeur de la boîte) ; son
 * équivalent pour un saut de ligne logiciel est le caractère "\v".
 */
export function normalizeSoftLineBreaks(text: string): string {
  return text.replace(/\u2028/g, '\v');
}
