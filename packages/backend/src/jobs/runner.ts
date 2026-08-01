import type { CalibrationData, IRDocument } from '@figma-to-slides/shared';
import { chunkBatchesForApi, mapDocumentToBatches, THEME_BATCH_SOURCE_ID, type AssetUrlResolver } from '../mapper/index.js';
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
  await updateJob(job.id, { status: 'running' });

  try {
    let presentationId = doc.targetPresentationId;
    let defaultSlideObjectId: string | undefined;
    let masterObjectId: string | undefined;

    if (!presentationId) {
      const created = await createPresentation(accessToken, doc.presentationTitle, doc.slideSize);
      presentationId = created.presentationId;
      defaultSlideObjectId = created.firstSlideObjectId;
      masterObjectId = created.masterObjectId;
      await updateJob(job.id, { presentationId, presentationUrl: presentationUrl(presentationId) });
    }

    const batches = mapDocumentToBatches(doc, resolveAssetUrl, calibration, masterObjectId);
    // Spec §5.4 : une slide = un lot indivisible ; on applique lot par lot
    // (chunkBatchesForApi ne serait utile que si l'API supportait la fusion
    // de plusieurs slides dans un seul batchUpdate sans risque partiel —
    // ici on l'utilise seulement pour documenter le regroupement logique).
    void chunkBatchesForApi;

    // Un `batch.error` nu ("Slides API 400 on …") n'identifie pas QUELLE
    // slide a échoué — le nom de frame Figma est le repère que l'utilisateur
    // du plugin connaît, on le préfixe donc à chaque erreur de lot. Le lot
    // spécial d'écriture du thème (audit 2026-08, `mapper/theme.ts`) n'est
    // pas une slide : nom lisible dédié plutôt que l'id technique brut.
    const frameNameBySlideId = new Map(doc.slides.map((s) => [s.sourceNodeId, s.frameName]));
    frameNameBySlideId.set(THEME_BATCH_SOURCE_ID, 'Theme (Master colors)');
    const failedSlideNames: string[] = [];
    for (const batch of batches) {
      try {
        await applyBatch(accessToken, presentationId, batch);
        await updateBatchStatus(job.id, batch.sourceSlideId, 'applied');
      } catch (err) {
        const frameName = frameNameBySlideId.get(batch.sourceSlideId) ?? batch.sourceSlideId;
        failedSlideNames.push(frameName);
        await updateBatchStatus(job.id, batch.sourceSlideId, 'failed', `Slide "${frameName}": ${(err as Error).message}`);
      }
    }
    const anyFailed = failedSlideNames.length > 0;

    // Spec §11.14 : la présentation nouvellement créée a une slide vide par
    // défaut — la supprimer une fois qu'au moins une slide réelle existe.
    if (defaultSlideObjectId && !anyFailed) {
      await applyBatch(accessToken, presentationId, {
        sourceSlideId: '__default__',
        requests: [{ deleteObject: { objectId: defaultSlideObjectId } }],
      }).catch(() => undefined);
    }

    await updateJob(job.id, {
      status: anyFailed ? 'failed' : 'done',
      error: anyFailed ? `${failedSlideNames.length} slide(s) failed (${failedSlideNames.join(', ')}) — see the per-slide errors for details.` : undefined,
    });
  } catch (err) {
    await updateJob(job.id, { status: 'failed', error: (err as Error).message });
    throw err;
  }
}

function presentationUrl(presentationId: string): string {
  return `https://docs.google.com/presentation/d/${presentationId}/edit`;
}
