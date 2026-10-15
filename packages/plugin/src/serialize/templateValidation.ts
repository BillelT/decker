import type { IRWarning } from '@figma-to-slides/shared';

/**
 * Ce qui bloque la création d'un template (décision du 2026-10-15).
 *
 * Un deck ponctuel accepte le raster comme compromis. Un template, lui, est
 * repris par d'autres, qui n'ont pas le fichier Figma : un élément figé en
 * image l'est pour tous. Mais tout bloquer menait à des culs-de-sac : une
 * icône ou une illustration n'a aucun équivalent natif dans Slides, et le
 * seul moyen de débloquer était de la supprimer. On ne bloque donc que ce
 * qui casse le template ou ce que « Prepare for Slides » sait corriger :
 *
 * 1. un tag de placeholder mal orthographié (`[[titel]]`) : le placeholder
 *    prévu manquerait dans le template livré ;
 * 2. un raster qui emporte du texte ou un placeholder : ils seraient figés
 *    en image, plus modifiables depuis Slides ;
 * 3. un raster que « Prepare » corrige (dégradé, ombre, fills multiples,
 *    tracking, police absente, rayon, style de ligne).
 *
 * Le reste (forme vectorielle complexe, masque, mode de fusion, polygone,
 * étoile, fond de frame image) part en image sans bloquer, signalé par la
 * même pastille grise « rasterized » que le mode Deck.
 *
 * `RADIUS_APPROXIMATED` et `FONT_SUBSTITUTED` ne sont pas des rasters :
 * l'élément reste natif, l'info garde son niveau d'origine.
 */
export const PREPARE_FIXABLE_CODES = new Set<IRWarning['code']>([
  'FONT_MISSING',
  'GRADIENT_RASTERIZED',
  'EFFECT_RASTERIZED',
  'LINE_RASTERIZED',
  'LETTER_SPACING_LOST',
  'CORNER_RADIUS_RASTERIZED',
  'MULTIPLE_FILLS_RASTERIZED',
]);

/** Rasters qu'aucun réglage ne rend natifs : ils ne bloquent que s'ils emportent du texte ou un placeholder. */
const UNFIXABLE_RASTER_CODES = new Set<IRWarning['code']>([
  'BLEND_MODE_RASTERIZED',
  'MASK_RASTERIZED',
  'VECTOR_RASTERIZED',
  'POLYGON_SIDES_UNSUPPORTED',
  'STAR_POINTS_UNSUPPORTED',
  'CONTAINER_BACKGROUND_RASTERIZED',
]);

/**
 * @param holdsTextOrPlaceholder vrai si le calque visé par l'avertissement
 *   est un texte ou un placeholder, ou en contient un : le raster le
 *   figerait. Calculé par l'appelant, qui a accès à l'arbre Figma.
 */
export function enforceTemplateStrictness(warnings: IRWarning[], holdsTextOrPlaceholder: (sourceNodeId: string) => boolean = () => false): IRWarning[] {
  return warnings.map((w) => {
    if (w.code === 'PLACEHOLDER_TAG_UNKNOWN' || PREPARE_FIXABLE_CODES.has(w.code)) return { ...w, severity: 'blocking' };
    if (UNFIXABLE_RASTER_CODES.has(w.code)) {
      return holdsTextOrPlaceholder(w.sourceNodeId) ? { ...w, severity: 'blocking' } : { ...w, severity: 'warning' };
    }
    return w;
  });
}

/** Un template n'est exportable que si plus aucun avertissement bloquant ne subsiste. */
export function hasBlockingWarnings(warnings: IRWarning[]): boolean {
  return warnings.some((w) => w.severity === 'blocking');
}

/** « Prepare this layout » n'a de sens que si au moins un blocage fait partie de ce que « Prepare » corrige. */
export function hasPrepareFixableBlocking(warnings: { code: string; severity: string }[]): boolean {
  return warnings.some((w) => w.severity === 'blocking' && PREPARE_FIXABLE_CODES.has(w.code as IRWarning['code']));
}
