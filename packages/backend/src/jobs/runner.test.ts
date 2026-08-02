import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { IRDocument, ThemeColorRole } from '@figma-to-slides/shared';
import { UNCALIBRATED_DEFAULTS } from '@figma-to-slides/shared';
import { THEME_BATCH_SOURCE_ID } from '../mapper/index.js';
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

  it('includes the theme batch in job.batches from creation, so a first-attempt failure is retryable (audit 2026-08 fix)', async () => {
    const THEME: Record<ThemeColorRole, { r: number; g: number; b: number }> = {
      DARK1: { r: 0, g: 0, b: 0 },
      LIGHT1: { r: 1, g: 1, b: 1 },
      DARK2: { r: 0.1, g: 0.1, b: 0.1 },
      LIGHT2: { r: 0.9, g: 0.9, b: 0.9 },
      ACCENT1: { r: 1, g: 0, b: 0 },
      ACCENT2: { r: 0, g: 1, b: 0 },
      ACCENT3: { r: 0, g: 0, b: 1 },
      ACCENT4: { r: 1, g: 1, b: 0 },
      ACCENT5: { r: 1, g: 0, b: 1 },
      ACCENT6: { r: 0, g: 1, b: 1 },
      HYPERLINK: { r: 0.2, g: 0.2, b: 0.8 },
      FOLLOWED_HYPERLINK: { r: 0.5, g: 0.2, b: 0.8 },
    };
    const doc: IRDocument = { ...buildDoc(['slideA']), theme: THEME };

    mockedCreatePresentation.mockResolvedValue({ presentationId: 'pres-theme', firstSlideObjectId: 'default-slide', masterObjectId: 'master-1' });
    mockedApplyBatch.mockImplementation(async (_token, _presId, batch) => {
      if (batch.sourceSlideId === THEME_BATCH_SOURCE_ID) throw new Error('Slides API 500 — transient');
      return {};
    });

    // Reproduit ce que `routes/export.ts` fait désormais : la sentinelle
    // thème doit figurer dans `job.batches` dès la création si `doc.theme`
    // est présent, sinon son échec n'est jamais suivi ni rejouable.
    const sourceSlideIds = [THEME_BATCH_SOURCE_ID, ...doc.slides.map((s) => s.sourceNodeId)];
    const job = await createJob('theme-retry', sourceSlideIds, doc);

    await runExportJob(job, doc, 'token', () => '', UNCALIBRATED_DEFAULTS);

    const failedJob = await getJob('theme-retry');
    expect(failedJob?.status).toBe('failed');
    expect(failedJob?.masterObjectId).toBe('master-1');
    expect(failedJob?.batches).toEqual([
      { sourceSlideId: THEME_BATCH_SOURCE_ID, status: 'failed', error: expect.stringContaining('Theme (Master colors)') },
      { sourceSlideId: 'slideA', status: 'applied', error: undefined },
    ]);

    mockedApplyBatch.mockReset();
    mockedApplyBatch.mockResolvedValue({});

    await retryExportJob(failedJob!, doc, 'token', () => '', UNCALIBRATED_DEFAULTS);

    const result = await getJob('theme-retry');
    expect(result?.status).toBe('done');
    expect(result?.batches).toEqual([
      { sourceSlideId: THEME_BATCH_SOURCE_ID, status: 'applied', error: undefined },
      { sourceSlideId: 'slideA', status: 'applied', error: undefined },
    ]);
    // Seul le lot thème est rejoué — slideA était déjà `applied`.
    expect(mockedApplyBatch).toHaveBeenCalledTimes(1);
    expect(mockedApplyBatch).toHaveBeenCalledWith('token', 'pres-theme', expect.objectContaining({ sourceSlideId: THEME_BATCH_SOURCE_ID }));
  });

  it('retryExportJob throws without touching the job when there is no presentationId to retry against', async () => {
    const doc = buildDoc(['slideA']);
    const job = await createJob('retry-no-presentation', ['slideA'], doc);

    await expect(retryExportJob(job, doc, 'token', () => '', UNCALIBRATED_DEFAULTS)).rejects.toThrow(/no presentationId/);
    expect(mockedApplyBatch).not.toHaveBeenCalled();
  });
});
