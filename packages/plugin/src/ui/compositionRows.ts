import type { TemplateElement, TemplateWarning } from './types.js';

/**
 * Répartition des calques d'un layout entre les deux listes du rapport de
 * template : "Composition" (les calques qui ont un rôle de placeholder) et
 * "Content" (les autres). Un calque change de liste dès que son rôle change :
 * le sandbox renomme le calque, le live refresh renvoie le layout, et la
 * répartition se refait d'elle-même.
 *
 * Les avertissements de composition (doublon de rôle, rôle incompatible
 * avec le type de calque, cf. serialize/templateComposition.ts) ne forment
 * plus une liste à part : ils marquent la ligne du calque concerné. Ceux qui
 * ne visent aucun calque tagué (le "aucun placeholder" du layout, porté par
 * la frame elle-même, ou un calque absent de la liste) restent à part.
 */
export interface CompositionRows {
  tagged: TemplateElement[];
  untagged: TemplateElement[];
  /** id du nœud source → messages de conflit, dans l'ordre des avertissements. */
  conflicts: Map<string, string[]>;
  /** Avertissements de composition sans ligne où s'afficher. */
  unattached: TemplateWarning[];
}

export function splitCompositionRows(elements: TemplateElement[], compositionWarnings: TemplateWarning[]): CompositionRows {
  const tagged = elements.filter((el) => el.role);
  const untagged = elements.filter((el) => !el.role);
  const taggedIds = new Set(tagged.map((el) => el.sourceNodeId));
  const conflicts = new Map<string, string[]>();
  const unattached: TemplateWarning[] = [];
  for (const w of compositionWarnings) {
    if (!taggedIds.has(w.sourceNodeId)) {
      unattached.push(w);
      continue;
    }
    const messages = conflicts.get(w.sourceNodeId) ?? [];
    if (!messages.includes(w.message)) messages.push(w.message);
    conflicts.set(w.sourceNodeId, messages);
  }
  return { tagged, untagged, conflicts, unattached };
}
