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
  'POLYGON_SIDES_UNSUPPORTED',
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

export interface LogEntryWarningLike {
  code: string;
  message: string;
  fontOriginal?: string;
  fontSubstitute?: string;
}

/**
 * Texte du tag affiché à gauche d'une entrée de log flaggée (rasterisé ou
 * approximé) : la raison précise plutôt que le mot générique "Rasterized"/
 * "Approximated" — le message à droite de l'entrée devient alors redondant
 * et peut être omis (voir DeckPanel.tsx/TemplatePanel.tsx).
 *
 * FONT_SUBSTITUTED est un cas particulier : `message` est figé au moment du
 * serialize côté sandbox (résolution par défaut), alors que l'utilisateur
 * peut ensuite choisir une autre police de remplacement dans le sélecteur
 * "Fonts" du bandeau (`fontOverrides`, état de l'UI) — sans repasser par le
 * sandbox. Reconstruire le texte à partir de `fontOriginal`/`fontOverrides`
 * ici, plutôt que d'afficher `message`, garde le tag exact quel que soit le
 * choix courant.
 *
 * Pour les autres codes, la phrase de `message` suit déjà le format
 * "<raison> — <conséquence>." (ex. decisionTree.ts) : la raison (avant le
 * tiret) suffit comme tag, sans dupliquer une liste de libellés à
 * maintenir en parallèle des messages.
 */
export function logEntryTagText(w: LogEntryWarningLike, fontOverrides: Record<string, string>): string {
  if (w.code === 'FONT_SUBSTITUTED' && w.fontOriginal) {
    const resolved = fontOverrides[w.fontOriginal] ?? w.fontSubstitute ?? w.fontOriginal;
    return `Font "${w.fontOriginal}" → "${resolved}"`;
  }
  const dashIndex = w.message.indexOf(' — ');
  const reason = dashIndex === -1 ? w.message : w.message.slice(0, dashIndex);
  return reason.endsWith('.') ? reason.slice(0, -1) : reason;
}
