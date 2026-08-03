/**
 * Repère à mettre en avant sur une entrée de log/rapport de fidélité : un
 * calque rasterisé quitte l'édition native (police, interligne, espacement
 * des lettres figés en pixels au moment de l'export) ; un calque gardé
 * natif mais listé ici (police substituée, radius approximé) peut malgré
 * tout rendre différemment de l'original faute d'équivalent exact côté
 * Slides. Les deux catégories méritent de sauter aux yeux plutôt que de se
 * fondre avec le reste des entrées (ex. tag de placeholder inconnu, qui est
 * un souci de config, pas de fidélité visuelle).
 *
 * Partagé entre le panneau Logs du deck (DeckPanel.tsx) et le rapport de
 * template (TemplatePanel.tsx) : les deux affichent le même type de warning
 * (serialize/templateValidation.ts ne fait que reclasser leur `severity` en
 * mode template, jamais leur `code`).
 */
const RASTERIZED_WARNING_CODES = new Set([
  'FONT_MISSING',
  'GRADIENT_RASTERIZED',
  'EFFECT_RASTERIZED',
  'BLEND_MODE_RASTERIZED',
  'MASK_RASTERIZED',
  'VECTOR_RASTERIZED',
  'LINE_RASTERIZED',
  'LETTER_SPACING_LOST',
  'CORNER_RADIUS_RASTERIZED',
  'MULTIPLE_FILLS_RASTERIZED',
  'CONTAINER_BACKGROUND_RASTERIZED',
]);

const VISUAL_DIFF_WARNING_CODES = new Set(['FONT_SUBSTITUTED', 'RADIUS_APPROXIMATED']);

export function logEntryFlag(code: string): 'rasterized' | 'visual-diff' | undefined {
  if (RASTERIZED_WARNING_CODES.has(code)) return 'rasterized';
  if (VISUAL_DIFF_WARNING_CODES.has(code)) return 'visual-diff';
  return undefined;
}
