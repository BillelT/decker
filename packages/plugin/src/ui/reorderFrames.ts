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
