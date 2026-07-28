/**
 * Figma n'expose que l'ordre de calque (z-index) via `children`/`selection`,
 * sans rapport avec l'ordre de présentation voulu par l'utilisateur — ces
 * boutons ▲▼ dans l'UI lui permettent de corriger l'ordre à la main.
 */
export function reorderFrames(order: string[], id: string, direction: -1 | 1): string[] {
  const idx = order.indexOf(id);
  const swapWith = idx + direction;
  if (idx === -1 || swapWith < 0 || swapWith >= order.length) return order;
  const next = [...order];
  [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
  return next;
}

/** Drag & drop : déplace `id` pour qu'il se retrouve à l'index `targetIndex` (le reste se décale). */
export function moveToIndex(order: string[], id: string, targetIndex: number): string[] {
  const idx = order.indexOf(id);
  if (idx === -1 || targetIndex < 0 || targetIndex >= order.length || idx === targetIndex) return order;
  const next = [...order];
  next.splice(idx, 1);
  next.splice(targetIndex, 0, id);
  return next;
}
