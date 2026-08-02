import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { waitUntil } from '@vercel/functions';
import type { IRDocument } from '@figma-to-slides/shared';
import { UNCALIBRATED_DEFAULTS } from '@figma-to-slides/shared';
import { getValidAccessToken, UnauthenticatedError } from '../auth/getAccessToken.js';
import { extractSessionToken } from './auth.js';
import { getAssetStore } from '../storage/index.js';
import type { AssetStore } from '../storage/assetStore.js';
import { createJob, getJob, pendingBatchIds } from '../jobs/jobStore.js';
import { runExportJob, retryExportJob } from '../jobs/runner.js';
import { THEME_BATCH_SOURCE_ID } from '../mapper/index.js';
import { loadCalibration } from '../calibration/loadCalibration.js';

export const exportRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function collectReferencedAssetKeys(doc: IRDocument): Set<string> {
  const keys = new Set<string>();
  for (const slide of doc.slides) {
    if (slide.underlay) keys.add(slide.underlay.assetKey);
    for (const el of slide.elements) {
      if (el.kind === 'image') keys.add(el.assetKey);
    }
  }
  return keys;
}

/** Assets référencés par un sous-ensemble de slides (par `sourceNodeId`) plutôt que par tout le document. */
function assetKeysForSlides(doc: IRDocument, sourceSlideIds: Set<string>): Set<string> {
  const keys = new Set<string>();
  for (const slide of doc.slides) {
    if (!sourceSlideIds.has(slide.sourceNodeId)) continue;
    if (slide.underlay) keys.add(slide.underlay.assetKey);
    for (const el of slide.elements) {
      if (el.kind === 'image') keys.add(el.assetKey);
    }
  }
  return keys;
}

/**
 * Spec §5.3 : supprime un asset dès que sa slide a été appliquée avec
 * succès — mais SEULEMENT celle-là. Un asset référencé par une slide encore
 * `failed` reste en stockage pour qu'une reprise ciblée (`/retry`) puisse
 * encore le récupérer (`store.getSignedUrl`, tant que son URL n'a pas
 * expiré côté `VercelBlobAssetStore`, TTL 1h). Relit le job (plutôt que de
 * réutiliser un état capturé avant l'exécution) pour refléter l'issue RÉELLE
 * de chaque lot.
 */
async function cleanupAppliedAssets(jobId: string, doc: IRDocument, store: AssetStore): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;
  const appliedSlideIds = new Set(job.batches.filter((b) => b.status === 'applied').map((b) => b.sourceSlideId));
  for (const key of assetKeysForSlides(doc, appliedSlideIds)) {
    await store.delete(key).catch(() => undefined);
  }
}

/**
 * Spec §6 CONTRAT — transport multipart/form-data : le champ `document`
 * contient l'IRDocument en JSON, chaque asset est un fichier nommé par son
 * `assetKey`. Spec §5: POST /export → IRDocument → batchUpdate.
 */
exportRouter.post('/export', upload.any(), async (req, res) => {
  const sessionToken = extractSessionToken(req);

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(sessionToken);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    throw err;
  }

  const documentField = req.body?.document;
  if (typeof documentField !== 'string') {
    res.status(400).json({ error: 'missing_document_field' });
    return;
  }

  let doc: IRDocument;
  try {
    doc = JSON.parse(documentField);
  } catch {
    res.status(400).json({ error: 'invalid_document_json' });
    return;
  }

  // §6: previewDataUrl est un champ UI uniquement, à retirer avant l'envoi.
  // On l'ignore défensivement même si le plugin oublie de le faire.
  for (const slide of doc.slides) {
    (slide as { previewDataUrl?: string }).previewDataUrl = '';
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const store = getAssetStore();
  const urlByAssetKey = new Map<string, string>();

  for (const file of files) {
    await store.put(file.fieldname, file.buffer, file.mimetype);
    urlByAssetKey.set(file.fieldname, await store.getSignedUrl(file.fieldname));
  }

  // Sur les gros exports, le plugin pré-uploade les assets par lots via
  // POST /assets (au lieu de tout joindre à cette requête) pour rester sous
  // la limite de taille de body des fonctions serverless Vercel (~4.5 Mo).
  // Ces assets ne sont donc pas dans `files` ci-dessus : on résout leur URL
  // via le store, qui les a déjà (voir vercelBlobAssetStore.ts — la clé y
  // survit entre requêtes grâce à Redis, pas seulement en mémoire).
  for (const key of collectReferencedAssetKeys(doc)) {
    if (urlByAssetKey.has(key)) continue;
    try {
      urlByAssetKey.set(key, await store.getSignedUrl(key));
    } catch {
      // Asset jamais uploadé (p. ex. rasterisation échouée côté plugin,
      // cf. code.ts) — resolveAssetUrl renverra '' pour cette clé, comme
      // avant ce changement.
    }
  }

  const jobId = randomUUID();
  // `doc` est conservé sur le job : nécessaire pour reconstruire les lots à
  // la reprise ciblée (voir `/export/:jobId/retry` plus bas). Le lot spécial
  // d'écriture du thème (sentinelle `THEME_BATCH_SOURCE_ID`, pas une vraie
  // slide) doit être inclus dans `job.batches` dès la création si `doc.theme`
  // est présent : sinon `updateBatchStatus`/`pendingBatchIds` ne le voient
  // jamais et un échec de ce lot devient irréparable (ni suivi, ni rejouable
  // par `/retry`).
  const sourceSlideIds = doc.slides.map((s) => s.sourceNodeId);
  if (doc.theme) sourceSlideIds.unshift(THEME_BATCH_SOURCE_ID);
  const job = await createJob(jobId, sourceSlideIds, doc);
  const calibration = await loadCalibration();

  // Traitement asynchrone : le plugin poll GET /export/:jobId (spec §5).
  // `waitUntil` (plutôt qu'un simple "fire and forget") : sur Vercel, la
  // fonction serverless peut être gelée/tuée dès que la réponse HTTP est
  // envoyée — sans ça, le job n'aurait aucune garantie de continuer à
  // s'exécuter après le `res.status(202)` ci-dessous. En dehors de Vercel
  // (dev local), `waitUntil` est un no-op inoffensif et la promesse
  // continue de s'exécuter normalement sur l'event loop Node.
  waitUntil(
    runExportJob(job, doc, accessToken, (key) => urlByAssetKey.get(key) ?? '', calibration)
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`[export ${jobId}] failed`, err);
      })
      .finally(() => cleanupAppliedAssets(jobId, doc, store)),
  );

  res.status(202).json({ jobId });
});

/** Spec §5: GET /export/:jobId → progression (polling). */
exportRouter.get('/export/:jobId', async (req, res) => {
  const job = await getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({
    id: job.id,
    status: job.status,
    error: job.error,
    presentationId: job.presentationId,
    presentationUrl: job.presentationUrl,
    batches: job.batches,
  });
});

/**
 * Reprise ciblée des lots non appliqués (spec §7.0.6) : ne rejoue QUE les
 * slides encore `failed`, sur la présentation déjà créée par le premier
 * passage — jamais une nouvelle présentation, jamais les slides déjà
 * réussies. Répond 202 et laisse tourner en arrière-plan comme `/export`,
 * pour le même polling `GET /export/:jobId` (le job existant se met à jour
 * en place, pas de nouveau `jobId`).
 */
exportRouter.post('/export/:jobId/retry', async (req, res) => {
  const sessionToken = extractSessionToken(req);

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(sessionToken);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    throw err;
  }

  const job = await getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  // Rien à reprendre : soit la présentation elle-même n'a jamais été créée
  // (l'appelant doit relancer un export complet depuis le plugin, pas une
  // reprise), soit aucun document n'a été conservé (job créé avant ce
  // champ, ou expiré) — dans les deux cas `retryExportJob` ne peut rien faire.
  if (!job.presentationId || !job.doc) {
    res.status(409).json({ error: 'not_retryable' });
    return;
  }

  const pendingSlideIds = await pendingBatchIds(job.id);
  if (pendingSlideIds.length === 0) {
    res.json({ pendingSlideIds: [] });
    return;
  }

  const doc = job.doc;
  const store = getAssetStore();
  const urlByAssetKey = new Map<string, string>();
  for (const key of assetKeysForSlides(doc, new Set(pendingSlideIds))) {
    try {
      urlByAssetKey.set(key, await store.getSignedUrl(key));
    } catch {
      // Asset expiré (TTL 1h côté VercelBlobAssetStore) ou jamais uploadé :
      // resolveAssetUrl renverra '' pour cette clé, la slide échouera à
      // nouveau avec une erreur Slides API explicite plutôt que de planter
      // toute la reprise.
    }
  }
  const calibration = await loadCalibration();

  waitUntil(
    retryExportJob(job, doc, accessToken, (key) => urlByAssetKey.get(key) ?? '', calibration)
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`[export ${job.id}] retry failed`, err);
      })
      .finally(() => cleanupAppliedAssets(job.id, doc, store)),
  );

  res.status(202).json({ pendingSlideIds });
});
