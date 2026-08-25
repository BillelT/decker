import type { IRWarning } from '@figma-to-slides/shared';

/**
 * brief-creation-template-google-slides.md — "contraintes plutôt que
 * liberté" : un deck ponctuel accepte le raster comme compromis (l'auteur
 * corrige lui-même s'il le souhaite), mais un template rasterisé fige cet
 * élément pour TOUS ses futurs utilisateurs, qui n'ont ni le fichier Figma
 * source ni la main sur le rendu. Tout code de warning qui signale un
 * raster (texte, forme ou ligne) est donc reclassé en `blocking` en mode
 * template, quel que soit son niveau d'origine — l'export reste possible
 * seulement une fois la frame 100% native.
 *
 * `RADIUS_APPROXIMATED` et `FONT_SUBSTITUTED` sont volontairement exclus :
 * l'élément reste natif/éditable dans ces deux cas (l'approximation ne
 * casse ni l'éditabilité ni la structure), donc l'info reste au niveau
 * d'origine plutôt que de bloquer un template pour un détail cosmétique.
 */
const RASTER_WARNING_CODES = new Set<IRWarning['code']>([
  'FONT_MISSING',
  'GRADIENT_RASTERIZED',
  'EFFECT_RASTERIZED',
  'BLEND_MODE_RASTERIZED',
  'MASK_RASTERIZED',
  'VECTOR_RASTERIZED',
  'POLYGON_SIDES_UNSUPPORTED',
  'STAR_POINTS_UNSUPPORTED',
  'LINE_RASTERIZED',
  'LETTER_SPACING_LOST',
  'CORNER_RADIUS_RASTERIZED',
  'MULTIPLE_FILLS_RASTERIZED',
  'CONTAINER_BACKGROUND_RASTERIZED',
  // Pas un raster, mais bloquant quand même en mode template : un tag de
  // placeholder mal orthographié (`[[titel]]`…) signifie qu'un placeholder
  // prévu MANQUERA dans le template livré — exactement le genre d'erreur qui
  // retombe sur tous les futurs utilisateurs, donc à corriger avant création
  // plutôt qu'à ignorer en silence.
  'PLACEHOLDER_TAG_UNKNOWN',
]);

export function enforceTemplateStrictness(warnings: IRWarning[]): IRWarning[] {
  return warnings.map((w) => (RASTER_WARNING_CODES.has(w.code) ? { ...w, severity: 'blocking' } : w));
}

/** Un template n'est exportable que si plus aucun avertissement bloquant ne subsiste. */
export function hasBlockingWarnings(warnings: IRWarning[]): boolean {
  return warnings.some((w) => w.severity === 'blocking');
}
