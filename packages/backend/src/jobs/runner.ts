import type { CalibrationData, IRDocument } from '@figma-to-slides/shared';
import { chunkBatchesForApi, mapDocumentToBatches, type AssetUrlResolver } from '../mapper/index.js';
import { applyBatch, createPresentation } from '../slides/client.js';
import { updateBatchStatus, updateJob, type JobRecord } from './jobStore.js';

/**
 * Spec §5.4 — exécute les lots d'un job, un par slide, sans jamais scinder
 * une slide entre deux appels `batchUpdate`. Un échec sur une slide
 * n'annule pas les autres (spec §8 Phase 3, critère de reprise ciblée) :
 * on continue et on marque ce lot `failed` pour permettre une reprise
 * ultérieure ciblée sur les lots non `applied`.
 */
export async function runExportJob(
  job: JobRecord,
  doc: IRDocument,
  accessToken: string,
  resolveAssetUrl: AssetUrlResolver,
  calibration: CalibrationData,
): Promise<void> {
  updateJob(job.id, { status: 'running' });

  try {
    let presentationId = doc.targetPresentationId;
    let defaultSlideObjectId: string | undefined;

    if (!presentationId) {
      const created = await createPresentation(accessToken, doc.presentationTitle);
      presentationId = created.presentationId;
      defaultSlideObjectId = created.firstSlideObjectId;
      updateJob(job.id, { presentationId, presentationUrl: presentationUrl(presentationId) });
    }

    const batches = mapDocumentToBatches(doc, resolveAssetUrl, calibration);
    // Spec §5.4 : une slide = un lot indivisible ; on applique lot par lot
    // (chunkBatchesForApi ne serait utile que si l'API supportait la fusion
    // de plusieurs slides dans un seul batchUpdate sans risque partiel —
    // ici on l'utilise seulement pour documenter le regroupement logique).
    void chunkBatchesForApi;

    let anyFailed = false;
    for (const batch of batches) {
      try {
        await applyBatch(accessToken, presentationId, batch);
        updateBatchStatus(job.id, batch.sourceSlideId, 'applied');
      } catch (err) {
        anyFailed = true;
        updateBatchStatus(job.id, batch.sourceSlideId, 'failed', (err as Error).message);
      }
    }

    // Spec §11.14 : la présentation nouvellement créée a une slide vide par
    // défaut — la supprimer une fois qu'au moins une slide réelle existe.
    if (defaultSlideObjectId && !anyFailed) {
      await applyBatch(accessToken, presentationId, {
        sourceSlideId: '__default__',
        requests: [{ deleteObject: { objectId: defaultSlideObjectId } }],
      }).catch(() => undefined);
    }

    updateJob(job.id, {
      status: anyFailed ? 'failed' : 'done',
      error: anyFailed ? 'Une ou plusieurs slides ont échoué — voir le détail par slide.' : undefined,
    });
  } catch (err) {
    updateJob(job.id, { status: 'failed', error: (err as Error).message });
    throw err;
  }
}

function presentationUrl(presentationId: string): string {
  return `https://docs.google.com/presentation/d/${presentationId}/edit`;
}
