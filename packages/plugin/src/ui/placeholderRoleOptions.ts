import { KNOWN_ROLE_TAGS } from '../serialize/placeholder.js';

/**
 * Codes de warning dont l'élément source est un calque TEXTE (natif ou
 * rasterisé faute d'alternative) — le sélecteur de rôle du rapport de
 * contenu (TemplatePanel) ne propose alors que les rôles texte.
 */
const TEXT_WARNING_CODES = new Set(['FONT_SUBSTITUTED', 'FONT_MISSING', 'LETTER_SPACING_LOST']);

/**
 * Codes dont l'élément finit toujours en image (dégradé, effet, masque,
 * vecteur, ligne, fond de conteneur…) — que le calque source soit lui-même
 * une image importe peu, seul compte ce que Slides recevra : le sélecteur
 * ne propose alors que les rôles image.
 */
const IMAGE_WARNING_CODES = new Set([
  'GRADIENT_RASTERIZED',
  'EFFECT_RASTERIZED',
  'BLEND_MODE_RASTERIZED',
  'MASK_RASTERIZED',
  'VECTOR_RASTERIZED',
  'POLYGON_SIDES_UNSUPPORTED',
  'STAR_POINTS_UNSUPPORTED',
  'LINE_RASTERIZED',
  'CORNER_RADIUS_RASTERIZED',
  'MULTIPLE_FILLS_RASTERIZED',
  'CONTAINER_BACKGROUND_RASTERIZED',
]);

const TEXT_ROLE_TAGS = KNOWN_ROLE_TAGS.filter((tag) => tag !== 'image' && tag !== 'logo');
const IMAGE_ROLE_TAGS = KNOWN_ROLE_TAGS.filter((tag) => tag !== 'title' && tag !== 'subtitle' && tag !== 'body');
const CUSTOM_ONLY_ROLE_TAGS = KNOWN_ROLE_TAGS.filter((tag) => tag === 'custom');

/**
 * Rôles de placeholder proposables pour une entrée du rapport de contenu,
 * selon ce que devient son élément à l'export. Un code qui n'est ni
 * clairement texte ni clairement image (RADIUS_APPROXIMATED — une forme
 * reste une forme, PLACEHOLDER_TAG_UNKNOWN — le calque source peut être
 * n'importe quoi) reçoit la liste complète plutôt que de deviner.
 */
export function placeholderRoleTagsFor(code: string): readonly (typeof KNOWN_ROLE_TAGS)[number][] {
  if (TEXT_WARNING_CODES.has(code)) return TEXT_ROLE_TAGS;
  if (IMAGE_WARNING_CODES.has(code)) return IMAGE_ROLE_TAGS;
  return KNOWN_ROLE_TAGS;
}

/**
 * Même filtrage, mais à partir du TYPE de l'élément sérialisé plutôt que du
 * code d'un avertissement : la liste "Content" du rapport de template liste
 * désormais tous les calques taguables, y compris ceux qui n'ont produit
 * aucun avertissement (voir summarizeTaggableElements), et le code de
 * warning n'est donc plus disponible pour deviner.
 *
 * Une FORME reçoit la liste complète : un rectangle vide est aussi bien un
 * emplacement d'image réservé (`[[image]]`) qu'un cartouche de titre
 * décoratif, rien ne permet de trancher ici. Une LIGNE n'en reçoit qu'un,
 * `custom` : elle n'apparaît dans la liste que parce qu'elle porte déjà un
 * tag, qu'il s'agit surtout de pouvoir retirer.
 */
export function placeholderRoleTagsForKind(kind: 'text' | 'shape' | 'image' | 'line'): readonly (typeof KNOWN_ROLE_TAGS)[number][] {
  if (kind === 'text') return TEXT_ROLE_TAGS;
  if (kind === 'image') return IMAGE_ROLE_TAGS;
  if (kind === 'line') return CUSTOM_ONLY_ROLE_TAGS;
  return KNOWN_ROLE_TAGS;
}
