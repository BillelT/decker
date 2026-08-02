import type { CalibrationData, IRDocument } from '@figma-to-slides/shared';
import { chunkBatchesForApi, mapDocumentToBatches, THEME_BATCH_SOURCE_ID, type AssetUrlResolver, type RequestBatch } from '../mapper/index.js';
import { applyBatch, createPresentation } from '../slides/client.js';
import { pendingBatchIds, updateBatchStatus, updateJob, type JobRecord } from './jobStore.js';

/**
 * Applique une liste de lots un par un (jamais de fusion, spec §5.4), sans
 * qu'un échec sur une slide n'annule les autres (spec §8 Phase 3, critère
 * de reprise ciblée) : on continue et on marque le lot `failed`. Partagé
 * entre le premier passage (`runExportJob`) et la reprise ciblée
 * (`retryExportJob`) — même comportement lot par lot dans les deux cas.
 *
 * Un lot `batchUpdate` Google Slides est appliqué de façon transactionnelle
 * (tout ou rien) : un lot `failed` n'a donc RIEN créé côté présentation,
 * rejouer le même lot (mêmes `objectId`) à la reprise est donc sûr — pas de
 * risque de doublon ni de collision d'id.
 */
async function applyBatches(jobId: string, presentationId: string, batches: RequestBatch[], accessToken: string, frameNameBySlideId: Map<string, string>): Promise<string[]> {
  const failedSlideNames: string[] = [];
  for (const batch of batches) {
    try {
      await applyBatch(accessToken, presentationId, batch);
      await updateBatchStatus(jobId, batch.sourceSlideId, 'applied');
    } catch (err) {
      const frameName = frameNameBySlideId.get(batch.sourceSlideId) ?? batch.sourceSlideId;
      failedSlideNames.push(frameName);
      await updateBatchStatus(jobId, batch.sourceSlideId, 'failed', `Slide "${frameName}": ${(err as Error).message}`);
    }
  }
  return failedSlideNames;
}

function failureSummary(failedSlideNames: string[], verb: string): string {
  return `${failedSlideNames.length} slide(s) ${verb} (${failedSlideNames.join(', ')}) — see the per-slide errors for details.`;
}

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
    const failedSlideNames = await applyBatches(job.id, presentationId, batches, accessToken, frameNameBySlideId);
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
      error: anyFailed ? failureSummary(failedSlideNames, 'failed') : undefined,
    });
  } catch (err) {
    await updateJob(job.id, { status: 'failed', error: (err as Error).message });
    throw err;
  }
}

/**
 * Reprise ciblée (spec §7.0.6, §8 Phase 3) : rejoue UNIQUEMENT les lots
 * encore non `applied` d'un job déjà conclu, sur la présentation déjà créée
 * par `runExportJob` — jamais de nouvelle présentation, jamais de replay
 * des lots déjà réussis. Suppose que l'appelant a vérifié `job.presentationId`
 * (rien à reprendre sans présentation existante : la création elle-même a
 * échoué, il faut relancer un export complet depuis le plugin).
 */
export async function retryExportJob(
  job: JobRecord,
  doc: IRDocument,
  accessToken: string,
  resolveAssetUrl: AssetUrlResolver,
  calibration: CalibrationData,
): Promise<void> {
  const presentationId = job.presentationId;
  if (!presentationId) throw new Error('retryExportJob: job has no presentationId — nothing to retry against.');

  await updateJob(job.id, { status: 'running' });

  try {
    const pendingIds = await pendingBatchIds(job.id);
    // Remis à `pending` (plutôt que laissés `failed`) AVANT de rejouer quoi
    // que ce soit : `exportCursorFromBatches` côté UI (ui/exportCursor.ts)
    // déduit la frame en cours du premier lot `pending` — sans ce reset, le
    // polling pendant la reprise ne verrait plus aucun lot `pending` (les
    // lots à reprendre sont encore marqués `failed` du passage précédent)
    // et la barre de progression resterait figée jusqu'à la conclusion.
    for (const id of pendingIds) {
      await updateBatchStatus(job.id, id, 'pending');
    }
    const pendingIdSet = new Set(pendingIds);
    const batches = mapDocumentToBatches(doc, resolveAssetUrl, calibration).filter((b) => pendingIdSet.has(b.sourceSlideId));
    const frameNameBySlideId = new Map(doc.slides.map((s) => [s.sourceNodeId, s.frameName]));
    const failedSlideNames = await applyBatches(job.id, presentationId, batches, accessToken, frameNameBySlideId);
    const stillFailed = failedSlideNames.length > 0;

    await updateJob(job.id, {
      status: stillFailed ? 'failed' : 'done',
      error: stillFailed ? failureSummary(failedSlideNames, 'still failing') : undefined,
    });
  } catch (err) {
    await updateJob(job.id, { status: 'failed', error: (err as Error).message });
    throw err;
  }
}

function presentationUrl(presentationId: string): string {
  return `https://docs.google.com/presentation/d/${presentationId}/edit`;
}
