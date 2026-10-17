import type { TextStats } from './templateSummary.js';

/**
 * "Suggest roles" de la section Composition (mode template) : propose un
 * rôle de placeholder à chaque texte du layout affiché, d'après sa forme.
 * Un layout porte autant de placeholders qu'il faut (trois cartes = trois
 * sous-titres et trois corps, voir backend mapper/templateLayouts.ts) :
 * 1. `title` : le texte écrit le plus gros, chiffre clé compris ("87%"
 *    affiché en grand est le titre de sa slide) ; à taille égale, le plus
 *    haut. Un seul titre par layout ;
 * 2. la taille de référence du corps est celle du texte le plus long des
 *    autres (à longueur égale, le plus petit), dès qu'il en reste deux ;
 * 3. `custom` : un autre chiffre clé ;
 * 4. `subtitle` : un texte court écrit plus gros que le corps (titres de
 *    cartes, chapô) ;
 * 5. `body` : les autres textes d'au moins `BODY_MIN_CHARS` caractères ou
 *    de plusieurs lignes ; plus court et pas plus gros que le corps, c'est
 *    une étiquette ("2026", "NEW") : rien à proposer.
 *
 * 6. `image` : chaque image, photo ou icône complexe partie en image.
 *    Deviner qu'une image est un logo est trop hasardeux : `[[logo]]` reste
 *    au choix du créateur. Les formes natives (aplats, cercles) sont du
 *    décor : rien à proposer.
 *
 * Même contrat que les rôles de couleur (templateColorRoles.ts) : un calque
 * qui a déjà un rôle n'est pas touché, et un titre n'est pas proposé si le
 * layout en a déjà un.
 */

export interface SuggestableElement {
  sourceNodeId: string;
  kind: string;
  role?: string;
  text?: TextStats;
}

export interface PlaceholderSuggestion {
  sourceNodeId: string;
  tag: 'title' | 'subtitle' | 'body' | 'custom' | 'image';
}

const BODY_MIN_CHARS = 20;
const SUBTITLE_MAX_CHARS = 140;

type Candidate = SuggestableElement & { text: TextStats };

function biggestFirst(a: Candidate, b: Candidate): number {
  return b.text.fontSizePx - a.text.fontSizePx || a.text.y - b.text.y;
}

export function suggestPlaceholderRoles(elements: SuggestableElement[]): PlaceholderSuggestion[] {
  const hasTitle = elements.some((el) => el.role === 'TITLE');
  const images: PlaceholderSuggestion[] = elements.filter((el) => el.kind === 'image' && !el.role).map((el) => ({ sourceNodeId: el.sourceNodeId, tag: 'image' }));
  const free: Candidate[] = elements.filter((el): el is Candidate => el.kind === 'text' && !el.role && !!el.text && el.text.chars > 0);
  if (free.length === 0) return images;

  const suggestions: PlaceholderSuggestion[] = [];
  const title = hasTitle ? undefined : [...free].sort(biggestFirst)[0];
  if (title) suggestions.push({ sourceNodeId: title.sourceNodeId, tag: 'title' });
  const rest = free.filter((el) => el !== title);

  const longest = [...rest].sort((a, b) => b.text.chars - a.text.chars || a.text.fontSizePx - b.text.fontSizePx)[0];
  const bodySize = rest.length >= 2 ? longest.text.fontSizePx : 0;

  for (const el of rest) {
    if (el.text.stat) suggestions.push({ sourceNodeId: el.sourceNodeId, tag: 'custom' });
    else if (el.text.fontSizePx > bodySize && el.text.chars <= SUBTITLE_MAX_CHARS) suggestions.push({ sourceNodeId: el.sourceNodeId, tag: 'subtitle' });
    else if (el.text.chars >= BODY_MIN_CHARS || el.text.paragraphs > 1) suggestions.push({ sourceNodeId: el.sourceNodeId, tag: 'body' });
  }
  return suggestions;
}
