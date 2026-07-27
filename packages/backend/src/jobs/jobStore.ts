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
}

/**
 * Spec §5.4 RÈGLE — idempotence : persiste l'état `pending`/`applied` par
 * lot pour qu'une reprise après échec ne rejoue pas un lot déjà appliqué.
 * En mémoire pour le dev ; à sauvegarder en DB pour survivre à un redémarrage
 * du process en production.
 */
const jobs = new Map<string, JobRecord>();

export function createJob(id: string, sourceSlideIds: string[]): JobRecord {
  const job: JobRecord = {
    id,
    status: 'pending',
    batches: sourceSlideIds.map((sourceSlideId) => ({ sourceSlideId, status: 'pending' })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): JobRecord | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<Omit<JobRecord, 'id' | 'batches'>>): void {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: Date.now() });
}

export function updateBatchStatus(id: string, sourceSlideId: string, status: BatchStatus, error?: string): void {
  const job = jobs.get(id);
  if (!job) return;
  const batch = job.batches.find((b) => b.sourceSlideId === sourceSlideId);
  if (batch) {
    batch.status = status;
    batch.error = error;
  }
  job.updatedAt = Date.now();
}

/** Lots restant à (ré)appliquer — utilisé pour la reprise ciblée (spec §7.0.6, §8 Phase 3). */
export function pendingBatchIds(id: string): string[] {
  const job = jobs.get(id);
  if (!job) return [];
  return job.batches.filter((b) => b.status !== 'applied').map((b) => b.sourceSlideId);
}
