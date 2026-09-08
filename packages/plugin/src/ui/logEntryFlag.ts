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
  'STAR_POINTS_UNSUPPORTED',
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

/**
 * Libellé court du tag, par code. Le tag tient sur UNE ligne (`white-space:
 * nowrap` + ellipse, cf. .f2s-log-entry-flag) : dériver son texte du
 * `message` donnait des libellés de 53 caractères en moyenne et jusqu'à 142
 * (CONTAINER_BACKGROUND_RASTERIZED), donc un bandeau tronqué qui écrasait le
 * nom du calque à sa gauche sans rien dire de plus. Ici, deux mots maximum :
 * la CAUSE. Ce qu'elle implique est déjà porté par la couleur du tag
 * (rouge = rasterisé, orange = natif mais approximé), et la phrase complète
 * reste disponible au survol (`title` des entrées, qui affiche `message`).
 */
const SHORT_TAG_LABELS: Record<string, string> = {
  FONT_MISSING: 'Font missing',
  GRADIENT_RASTERIZED: 'Gradient',
  EFFECT_RASTERIZED: 'Effect',
  BLEND_MODE_RASTERIZED: 'Blend mode',
  MASK_RASTERIZED: 'Mask',
  VECTOR_RASTERIZED: 'Vector',
  POLYGON_SIDES_UNSUPPORTED: 'Polygon sides',
  STAR_POINTS_UNSUPPORTED: 'Star points',
  LINE_RASTERIZED: 'Line style',
  LETTER_SPACING_LOST: 'Letter spacing',
  CORNER_RADIUS_RASTERIZED: 'Corner radius',
  MULTIPLE_FILLS_RASTERIZED: 'Multiple fills',
  CONTAINER_BACKGROUND_RASTERIZED: 'Frame background',
  RADIUS_APPROXIMATED: 'Radius approximated',
};

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
 * choix courant. La flèche dit déjà "remplacée par" : ni le mot "Font" ni
 * les guillemets n'ajoutent d'information, et ils coûtaient une quinzaine
 * de caractères sur une ligne qui n'en a pas à perdre.
 *
 * Pour les autres codes, le libellé vient de SHORT_TAG_LABELS. Le découpage
 * du `message` sur ": " ne sert plus que de filet pour un code qui n'y
 * serait pas encore listé.
 */
export function logEntryTagText(w: LogEntryWarningLike, fontOverrides: Record<string, string>): string {
  if (w.code === 'FONT_SUBSTITUTED' && w.fontOriginal) {
    const resolved = fontOverrides[w.fontOriginal] ?? w.fontSubstitute ?? w.fontOriginal;
    return `${w.fontOriginal} → ${resolved}`;
  }
  const short = SHORT_TAG_LABELS[w.code];
  if (short) return short;
  const colonIndex = w.message.indexOf(': ');
  const reason = colonIndex === -1 ? w.message : w.message.slice(0, colonIndex);
  return reason.endsWith('.') ? reason.slice(0, -1) : reason;
}

/**
 * Texte du `title` d'une entrée : la phrase complète, puisque le tag visible
 * ne porte plus que la cause en deux mots. Seul FONT_SUBSTITUTED y échappe —
 * son `message` est figé au serialize et ignore le remplacement choisi
 * depuis le bandeau "Fonts", c'est donc le tag (reconstruit) qui dit vrai.
 */
export function logEntryTooltip(w: LogEntryWarningLike, tagText: string | undefined): string {
  if (w.code === 'FONT_SUBSTITUTED' && tagText) return `Font ${tagText}`;
  return w.message;
}
