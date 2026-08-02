import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { IRDocument } from '@figma-to-slides/shared';
import { UNCALIBRATED_DEFAULTS } from '@figma-to-slides/shared';
import { createJob, getJob } from './jobStore.js';
import { runExportJob, retryExportJob } from './runner.js';

// `runner.ts` n'appelle jamais l'API Slides réelle en test : on mocke
// `slides/client.ts` pour piloter précisément quel lot réussit/échoue, sans
// dépendre du réseau ni d'identifiants Google (cf. LIMITATIONS.md — l'API
// Slides réelle n'est exercée nulle part dans ce dépôt).
vi.mock('../slides/client.js', () => ({
  createPresentation: vi.fn(),
  applyBatch: vi.fn(),
}));

import { applyBatch, createPresentation } from '../slides/client.js';

const mockedCreatePresentation = vi.mocked(createPresentation);
const mockedApplyBatch = vi.mocked(applyBatch);

function buildDoc(slideIds: string[]): IRDocument {
  return {
    version: 1,
    presentationTitle: 'Test deck',
    slideSize: { widthPt: 720, heightPt: 405 },
    options: { mode: 'new-presentation', rasterScale: 2, includeUnderlay: false, underlayOpacity: 0.3, strictMode: false },
    slides: slideIds.map((id, i) => ({
      sourceNodeId: id,
      frameName: `Frame ${id}`,
      order: i,
      frameSize: { width: 1280, height: 720 },
      elements: [],
      warnings: [],
    })),
  };
}

describe('runExportJob / retryExportJob', () => {
  beforeEach(() => {
    mockedCreatePresentation.mockReset();
    mockedApplyBatch.mockReset();
  });

  it('marks the job done when every batch succeeds, and deletes the default slide', async () => {
    mockedCreatePresentation.mockResolvedValue({ presentationId: 'pres-1', firstSlideObjectId: 'default-slide' });
    mockedApplyBatch.mockResolvedValue({});

    const doc = buildDoc(['slideA', 'slideB']);
    const job = await createJob('run-all-ok', doc.slides.map((s) => s.sourceNodeId), doc);

    await runExportJob(job, doc, 'token', () => '', UNCALIBRATED_DEFAULTS);

    const result = await getJob('run-all-ok');
    expect(result?.status).toBe('done');
    expect(result?.error).toBeUndefined();
    expect(result?.batches).toEqual([
      { sourceSlideId: 'slideA', status: 'applied', error: undefined },
      { sourceSlideId: 'slideB', status: 'applied', error: undefined },
    ]);
    // 2 slides + 1 suppression de la slide vide par défaut.
    expect(mockedApplyBatch).toHaveBeenCalledTimes(3);
    expect(mockedApplyBatch).toHaveBeenLastCalledWith(
      'token',
      'pres-1',
      expect.objectContaining({ requests: [{ deleteObject: { objectId: 'default-slide' } }] }),
    );
  });

  it('keeps the presentation and marks only the failing slide, without touching the others', async () => {
    mockedCreatePresentation.mockResolvedValue({ presentationId: 'pres-2', firstSlideObjectId: 'default-slide' });
    mockedApplyBatch.mockImplementation(async (_token, _presId, batch) => {
      if (batch.sourceSlideId === 'slideB') throw new Error('Slides API 400 on batchUpdate — bad request');
      return {};
    });

    const doc = buildDoc(['slideA', 'slideB', 'slideC']);
    const job = await createJob('run-partial-fail', doc.slides.map((s) => s.sourceNodeId), doc);

    await runExportJob(job, doc, 'token', () => '', UNCALIBRATED_DEFAULTS);

    const result = await getJob('run-partial-fail');
    expect(result?.status).toBe('failed');
    expect(result?.presentationId).toBe('pres-2');
    expect(result?.error).toContain('slideB');
    expect(result?.batches).toEqual([
      { sourceSlideId: 'slideA', status: 'applied', error: undefined },
      { sourceSlideId: 'slideB', status: 'failed', error: expect.stringContaining('Slide "Frame slideB"') },
      { sourceSlideId: 'slideC', status: 'applied', error: undefined },
    ]);
    // La slide par défaut n'est PAS supprimée tant qu'un échec subsiste
    // (spec §11.14) : 3 slides tentées, jamais de 4e appel deleteObject.
    expect(mockedApplyBatch).toHaveBeenCalledTimes(3);
  });

  it('retryExportJob only replays the still-failing batch, and leaves already-applied slides untouched', async () => {
    mockedCreatePresentation.mockResolvedValue({ presentationId: 'pres-3', firstSlideObjectId: 'default-slide' });
    mockedApplyBatch.mockImplementation(async (_token, _presId, batch) => {
      if (batch.sourceSlideId === 'slideB') throw new Error('Slides API 500 — transient');
      return {};
    });

    const doc = buildDoc(['slideA', 'slideB']);
    const job = await createJob('retry-then-ok', doc.slides.map((s) => s.sourceNodeId), doc);
    await runExportJob(job, doc, 'token', () => '', UNCALIBRATED_DEFAULTS);
    expect((await getJob('retry-then-ok'))?.status).toBe('failed');

    mockedApplyBatch.mockReset();
    mockedApplyBatch.mockResolvedValue({});

    const failedJob = await getJob('retry-then-ok');
    await retryExportJob(failedJob!, doc, 'token', () => '', UNCALIBRATED_DEFAULTS);

    const result = await getJob('retry-then-ok');
    expect(result?.status).toBe('done');
    expect(result?.error).toBeUndefined();
    expect(result?.batches).toEqual([
      { sourceSlideId: 'slideA', status: 'applied', error: undefined },
      { sourceSlideId: 'slideB', status: 'applied', error: undefined },
    ]);
    // Un seul lot rejoué (slideB) — pas slideA, déjà appliqué, et jamais de
    // nouvelle présentation créée.
    expect(mockedApplyBatch).toHaveBeenCalledTimes(1);
    expect(mockedApplyBatch).toHaveBeenCalledWith('token', 'pres-3', expect.objectContaining({ sourceSlideId: 'slideB' }));
    expect(mockedCreatePresentation).toHaveBeenCalledTimes(1);
  });

  it('retryExportJob throws without touching the job when there is no presentationId to retry against', async () => {
    const doc = buildDoc(['slideA']);
    const job = await createJob('retry-no-presentation', ['slideA'], doc);

    await expect(retryExportJob(job, doc, 'token', () => '', UNCALIBRATED_DEFAULTS)).rejects.toThrow(/no presentationId/);
    expect(mockedApplyBatch).not.toHaveBeenCalled();
  });
});
