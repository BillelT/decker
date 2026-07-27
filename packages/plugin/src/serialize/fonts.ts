/**
 * Spec §3.5 RÈGLE polices. Le sandbox Figma (`code.ts`) n'a pas de `fetch`
 * (piège §11.11) : on ne peut donc pas interroger `webfonts/v1` en direct
 * pendant la sérialisation. On résout contre une liste statique embarquée
 * (rafraîchie périodiquement à la main / par script), et le backend
 * revalide contre l'API Google Fonts live avant l'export final comme
 * garde-fou (voir LIMITATIONS.md).
 */

// Sous-ensemble représentatif — à étendre/régénérer depuis
// https://www.googleapis.com/webfonts/v1/webfonts au besoin.
export const GOOGLE_FONTS_SAMPLE = new Set([
  'Roboto',
  'Open Sans',
  'Inter',
  'Lato',
  'Montserrat',
  'Poppins',
  'Nunito',
  'Nunito Sans',
  'Source Sans Pro',
  'Raleway',
  'Ubuntu',
  'Merriweather',
  'Playfair Display',
  'PT Sans',
  'Noto Sans',
  'Work Sans',
  'Rubik',
  'Mulish',
  'Karla',
  'Fira Sans',
  'DM Sans',
  'Manrope',
  'Barlow',
  'IBM Plex Sans',
  'Space Grotesk',
  'Oswald',
  'Josefin Sans',
]);

export const SLIDES_SYSTEM_FONTS = new Set([
  'Arial',
  'Times New Roman',
  'Verdana',
  'Georgia',
  'Courier New',
  'Trebuchet MS',
  'Impact',
  'Comic Sans MS',
]);

/** Table de substitution explicite (spec §3.5, exemples donnés). */
export const FONT_SUBSTITUTIONS: Record<string, string> = {
  'SF Pro Text': 'Inter',
  'SF Pro Display': 'Inter',
  'Helvetica Neue': 'Arial',
  Helvetica: 'Arial',
  'Segoe UI': 'Open Sans',
  Söhne: 'Open Sans',
  'SF Compact': 'Inter',
};

export type FontResolution =
  | { status: 'available'; family: string }
  | { status: 'substituted'; family: string; original: string }
  | { status: 'missing'; original: string };

export function resolveFontFamily(family: string): FontResolution {
  if (GOOGLE_FONTS_SAMPLE.has(family) || SLIDES_SYSTEM_FONTS.has(family)) {
    return { status: 'available', family };
  }
  const substitute = FONT_SUBSTITUTIONS[family];
  if (substitute) {
    return { status: 'substituted', family: substitute, original: family };
  }
  return { status: 'missing', original: family };
}

/** Spec §3.5 — parse le style Figma ("Bold", "Semi Bold", "Regular"…) en poids 100..900. */
const STYLE_WEIGHT_KEYWORDS: [RegExp, number][] = [
  [/thin/i, 100],
  [/extra ?light|ultra ?light/i, 200],
  [/light/i, 300],
  [/regular|normal|^book$/i, 400],
  [/medium/i, 500],
  [/semi ?bold|demi ?bold/i, 600],
  [/extra ?bold|ultra ?bold/i, 800],
  [/black|heavy/i, 900],
  [/bold/i, 700],
];

export function parseFontWeight(figmaStyle: string): number {
  for (const [re, weight] of STYLE_WEIGHT_KEYWORDS) {
    if (re.test(figmaStyle)) return weight;
  }
  return 400;
}
