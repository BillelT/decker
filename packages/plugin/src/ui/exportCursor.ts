/**
 * Suivi de "quelle frame est en cours d'export" pour l'aperçu du deck.
 *
 * Le backend applique les lots un par un, dans l'ordre du deck
 * (packages/backend/src/jobs/runner.ts), et `sourceSlideId` d'un lot n'est
 * rien d'autre que l'id du nœud Figma de la frame
 * (`slide.sourceNodeId === frame.id`). Le polling `/export/:jobId` renvoie
 * donc, sans champ supplémentaire, de quoi déduire la frame en cours : le
 * PREMIER lot encore `pending`.
 */

export type ExportBatchStatus = 'pending' | 'applied' | 'failed';

export interface ExportBatch {
  sourceSlideId: string;
  status: ExportBatchStatus;
  /** Message d'erreur du lot (backend jobs/runner.ts) — présent seulement si `status === 'failed'`. */
  error?: string;
}

export interface ExportCursor {
  /** Id du nœud Figma de la frame en cours d'export. */
  frameId: string;
  /** Position 0-based de cette frame dans le deck exporté. */
  index: number;
  total: number;
}

/**
 * Frame en cours d'export, ou `undefined` si tous les lots sont retombés
 * (tout appliqué, ou échec — dans les deux cas plus rien n'est "en cours").
 */
export function exportCursorFromBatches(batches: ExportBatch[] | undefined): ExportCursor | undefined {
  if (!batches || batches.length === 0) return undefined;
  const index = batches.findIndex((b) => b.status === 'pending');
  if (index === -1) return undefined;
  return { frameId: batches[index].sourceSlideId, index, total: batches.length };
}
