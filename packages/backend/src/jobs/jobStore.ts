import type { IRDocument } from '@figma-to-slides/shared';
import { getRedis } from '../kv.js';

export type BatchStatus = 'pending' | 'applied' | 'failed';
export type JobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface BatchState {
  sourceSlideId: string;
  status: BatchStatus;
  error?: string;
}

export interface JobRecord {
  id: string;
  status: JobStatus;
  error?: string;
  presentationId?: string;
  presentationUrl?: string;
  batches: BatchState[];
  createdAt: number;
  updatedAt: number;
  /**
   * IRDocument original, conservé pour permettre une reprise ciblée des
   * lots échoués (spec §7.0.6, POST /export/:jobId/retry) : rejouer un lot
   * exige de reconstruire son `RequestBatch` via `mapDocumentToBatches`,
   * qui a besoin du document complet. Absent si le job a été créé sans
   * (voir tests) — dans ce cas la reprise n'est simplement pas possible.
   */
  doc?: IRDocument;
}

/**
 * Spec §5.4 RÈGLE — idempotence : persiste l'état `pending`/`applied` par
 * lot pour qu'une reprise après échec ne rejoue pas un lot déjà appliqué.
 * Store via `kv.ts` (Redis en production, in-memory en dev sans
 * credentials) : sur Vercel, la fonction qui exécute le job (via
 * waitUntil) et celle qui répond au polling `/export/:jobId` peuvent être
 * des invocations/instances distinctes sans mémoire partagée.
 */
const JOB_TTL_SEC = 24 * 3600;
const jobKey = (id: string) => `f2s:job:${id}`;

export async function createJob(id: string, sourceSlideIds: string[], doc?: IRDocument): Promise<JobRecord> {
  const job: JobRecord = {
    id,
    status: 'pending',
    batches: sourceSlideIds.map((sourceSlideId) => ({ sourceSlideId, status: 'pending' })),
    doc,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await getRedis().set(jobKey(id), job, { ex: JOB_TTL_SEC });
  return job;
}

export async function getJob(id: string): Promise<JobRecord | undefined> {
  const job = await getRedis().get<JobRecord>(jobKey(id));
  return job ?? undefined;
}

export async function updateJob(id: string, patch: Partial<Omit<JobRecord, 'id' | 'batches'>>): Promise<void> {
  const job = await getJob(id);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: Date.now() });
  await getRedis().set(jobKey(id), job, { ex: JOB_TTL_SEC });
}

export async function updateBatchStatus(id: string, sourceSlideId: string, status: BatchStatus, error?: string): Promise<void> {
  const job = await getJob(id);
  if (!job) return;
  const batch = job.batches.find((b) => b.sourceSlideId === sourceSlideId);
  if (batch) {
    batch.status = status;
    batch.error = error;
  }
  job.updatedAt = Date.now();
  await getRedis().set(jobKey(id), job, { ex: JOB_TTL_SEC });
}

/** Lots restant à (ré)appliquer — utilisé pour la reprise ciblée (spec §7.0.6, §8 Phase 3). */
export async function pendingBatchIds(id: string): Promise<string[]> {
  const job = await getJob(id);
  if (!job) return [];
  return job.batches.filter((b) => b.status !== 'applied').map((b) => b.sourceSlideId);
}
