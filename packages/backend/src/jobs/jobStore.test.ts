import { describe, expect, it } from 'vitest';
import { createJob, getJob, updateJob, updateBatchStatus, pendingBatchIds } from './jobStore.js';

// Pas de credentials Redis dans l'environnement de test → `kv.ts` retombe
// sur son store en mémoire (voir kv.test.ts pour la logique de dispatch
// elle-même) ; ce fichier teste juste le comportement de jobStore.ts.
// Chaque test utilise un id de job distinct : le store persiste au sein du
// même fichier de test, pas de raison d'ajouter un mécanisme de reset.

describe('job store', () => {
  it('creates a job with one pending batch per slide', async () => {
    const job = await createJob('job-create', ['slideA', 'slideB']);
    expect(job.status).toBe('pending');
    expect(job.batches).toEqual([
      { sourceSlideId: 'slideA', status: 'pending' },
      { sourceSlideId: 'slideB', status: 'pending' },
    ]);
  });

  it('round-trips through getJob', async () => {
    await createJob('job-roundtrip', ['slideA']);
    const job = await getJob('job-roundtrip');
    expect(job?.id).toBe('job-roundtrip');
  });

  it('returns undefined for an unknown job id', async () => {
    expect(await getJob('does-not-exist')).toBeUndefined();
  });

  it('updateJob patches fields and bumps updatedAt', async () => {
    const created = await createJob('job-update', ['slideA']);
    await updateJob('job-update', { status: 'done', presentationUrl: 'https://slides/1' });
    const job = await getJob('job-update');
    expect(job?.status).toBe('done');
    expect(job?.presentationUrl).toBe('https://slides/1');
    expect(job?.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
  });

  it('updateJob is a no-op for an unknown job id', async () => {
    await expect(updateJob('does-not-exist', { status: 'done' })).resolves.toBeUndefined();
  });

  it('updateBatchStatus updates only the targeted batch', async () => {
    await createJob('job-batches', ['slideA', 'slideB']);
    await updateBatchStatus('job-batches', 'slideA', 'applied');
    await updateBatchStatus('job-batches', 'slideB', 'failed', 'boom');
    const job = await getJob('job-batches');
    expect(job?.batches).toEqual([
      { sourceSlideId: 'slideA', status: 'applied' },
      { sourceSlideId: 'slideB', status: 'failed', error: 'boom' },
    ]);
  });

  it('pendingBatchIds returns only slides not yet applied', async () => {
    await createJob('job-pending', ['slideA', 'slideB', 'slideC']);
    await updateBatchStatus('job-pending', 'slideA', 'applied');
    await updateBatchStatus('job-pending', 'slideB', 'failed', 'boom');
    expect(await pendingBatchIds('job-pending')).toEqual(['slideB', 'slideC']);
  });

  it('pendingBatchIds returns an empty array for an unknown job id', async () => {
    expect(await pendingBatchIds('does-not-exist')).toEqual([]);
  });
});
