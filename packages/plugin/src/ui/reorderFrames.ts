/** Drag & drop : déplace `id` pour qu'il se retrouve à l'index `targetIndex` (le reste se décale). */
export function moveToIndex(order: string[], id: string, targetIndex: number): string[] {
  const idx = order.indexOf(id);
  if (idx === -1 || targetIndex < 0 || targetIndex >= order.length || idx === targetIndex) return order;
  const next = [...order];
  next.splice(idx, 1);
  next.splice(targetIndex, 0, id);
  return next;
}
