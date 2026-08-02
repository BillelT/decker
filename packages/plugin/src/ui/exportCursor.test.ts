import { describe, expect, it } from 'vitest';
import { exportCursorFromBatches, type ExportBatch } from './exportCursor.js';

const batches = (...statuses: ExportBatch['status'][]): ExportBatch[] =>
  statuses.map((status, i) => ({ sourceSlideId: `frame-${i}`, status }));

describe('exportCursorFromBatches', () => {
  it('pointe la première frame tant que rien n’est appliqué', () => {
    expect(exportCursorFromBatches(batches('pending', 'pending', 'pending'))).toEqual({
      frameId: 'frame-0',
      index: 0,
      total: 3,
    });
  });

  it('avance sur le premier lot encore pending', () => {
    expect(exportCursorFromBatches(batches('applied', 'applied', 'pending'))).toEqual({
      frameId: 'frame-2',
      index: 2,
      total: 3,
    });
  });

  // Un lot en échec n'arrête pas le runner : il passe au suivant, donc le
  // curseur doit sauter par-dessus plutôt que de rester bloqué dessus.
  it('saute les lots en échec', () => {
    expect(exportCursorFromBatches(batches('failed', 'pending', 'pending'))).toEqual({
      frameId: 'frame-1',
      index: 1,
      total: 3,
    });
  });

  it('ne renvoie plus rien quand aucun lot n’est en cours', () => {
    expect(exportCursorFromBatches(batches('applied', 'applied'))).toBeUndefined();
    expect(exportCursorFromBatches(batches('applied', 'failed'))).toBeUndefined();
    expect(exportCursorFromBatches([])).toBeUndefined();
    expect(exportCursorFromBatches(undefined)).toBeUndefined();
  });
});
