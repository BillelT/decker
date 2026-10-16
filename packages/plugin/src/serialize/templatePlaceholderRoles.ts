import type { PlaceholderRole } from '@figma-to-slides/shared';
import type { TextStats } from './templateSummary.js';

/**
 * "Suggest roles" de la section Composition (mode template) : propose un
 * rôle de placeholder aux textes du layout affiché, d'après leur forme.
 * 0. `custom` : chaque chiffre clé ("87%", "120k"), qui n'est ni un titre
 *    ni un corps (voir `isStatText`) ;
 * 1. `title` : le texte écrit le plus gros (à taille égale, le plus haut) ;
 * 2. `body` : le texte le plus long parmi les autres, s'il a l'allure d'un
 *    paragraphe (`BODY_MIN_CHARS` caractères ou plusieurs lignes) ;
 * 3. `subtitle` : le plus gros des textes courts restants, s'il est écrit
 *    plus gros que tous les autres textes hors titre (sinon c'est une
 *    légende, un numéro, une mention : rien à proposer).
 *
 * Même contrat que les rôles de couleur (templateColorRoles.ts) : un calque
 * qui a déjà un rôle n'est pas touché, et un rôle déjà présent dans le
 * layout n'est pas proposé une deuxième fois. Images et logos sont laissés
 * de côté : deviner qu'une image est un logo est trop hasardeux.
 */

export interface SuggestableElement {
  sourceNodeId: string;
  kind: string;
  role?: string;
  text?: TextStats;
}

export interface PlaceholderSuggestion {
  sourceNodeId: string;
  tag: 'title' | 'subtitle' | 'body' | 'custom';
}

const BODY_MIN_CHARS = 80;
const SUBTITLE_MAX_CHARS = 140;

const ROLE_OF_TAG: Record<Exclude<PlaceholderSuggestion['tag'], 'custom'>, PlaceholderRole> = { title: 'TITLE', subtitle: 'SUBTITLE', body: 'BODY' };

type Candidate = SuggestableElement & { text: TextStats };

function biggestFirst(a: Candidate, b: Candidate): number {
  return b.text.fontSizePx - a.text.fontSizePx || a.text.y - b.text.y;
}

export function suggestPlaceholderRoles(elements: SuggestableElement[]): PlaceholderSuggestion[] {
  const present = new Set(elements.map((el) => el.role).filter(Boolean));
  const candidates: Candidate[] = elements.filter((el): el is Candidate => el.kind === 'text' && !el.role && !!el.text && el.text.chars > 0);
  if (candidates.length === 0) return [];

  const suggestions: PlaceholderSuggestion[] = candidates.filter((el) => el.text.stat).map((el) => ({ sourceNodeId: el.sourceNodeId, tag: 'custom' }));
  const free = candidates.filter((el) => !el.text.stat);
  if (free.length === 0) return suggestions;

  const take = (el: Candidate | undefined, tag: Exclude<PlaceholderSuggestion['tag'], 'custom'>) => {
    if (!el || present.has(ROLE_OF_TAG[tag])) return;
    suggestions.push({ sourceNodeId: el.sourceNodeId, tag });
    free.splice(free.indexOf(el), 1);
  };

  const titleIds = new Set(elements.filter((el) => el.role === 'TITLE').map((el) => el.sourceNodeId));
  if (titleIds.size === 0) {
    const title = [...free].sort(biggestFirst)[0];
    take(title, 'title');
    titleIds.add(title.sourceNodeId);
  }

  const longest = [...free].sort((a, b) => b.text.chars - a.text.chars)[0];
  if (longest && (longest.text.chars >= BODY_MIN_CHARS || longest.text.paragraphs > 1)) take(longest, 'body');

  const subtitle = free.filter((el) => el.text.chars <= SUBTITLE_MAX_CHARS).sort(biggestFirst)[0];
  const others = elements.filter((el) => el.kind === 'text' && el.text && !el.text.stat && el !== subtitle && !titleIds.has(el.sourceNodeId));
  if (subtitle && others.every((el) => subtitle.text.fontSizePx > el.text!.fontSizePx)) take(subtitle, 'subtitle');

  return suggestions;
}
