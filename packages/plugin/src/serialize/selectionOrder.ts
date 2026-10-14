/**
 * Ordre dans lequel l'utilisateur a sélectionné les frames sur le canvas,
 * pour que « Add » les ajoute dans cet ordre-là (code.ts,
 * `orderedSelectedFrames`). Recalculé à chaque `selectionchange` : les
 * frames encore sélectionnées gardent leur rang, les nouvelles passent à la
 * suite. Celles qui arrivent d'un seul geste (rectangle de sélection,
 * Ctrl+A, plage dans le panneau des calques) n'ont pas d'ordre de clic :
 * elles suivent l'ordre de lecture du canvas, de haut en bas puis de gauche
 * à droite.
 */

export interface SelectedFrame {
  id: string;
  /** `absoluteBoundingBox` du nœud ; `null` pour un nœud sans boîte (ordre conservé). */
  box: { x: number; y: number; width: number; height: number } | null;
}

/** Deux frames dont les hauts sont décalés de moins d'une demi-hauteur sont sur la même rangée : on les lit de gauche à droite. */
export function readingOrder(a: SelectedFrame, b: SelectedFrame): number {
  if (!a.box || !b.box) return 0;
  const sameRow = Math.abs(a.box.y - b.box.y) < Math.min(a.box.height, b.box.height) / 2;
  return sameRow ? a.box.x - b.box.x : a.box.y - b.box.y;
}

export function nextSelectionOrder(previous: string[], selected: SelectedFrame[]): string[] {
  const selectedIds = new Set(selected.map((f) => f.id));
  const kept = previous.filter((id) => selectedIds.has(id));
  const keptIds = new Set(kept);
  const added = selected.filter((f) => !keptIds.has(f.id)).sort(readingOrder);
  return [...kept, ...added.map((f) => f.id)];
}
