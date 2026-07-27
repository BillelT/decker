import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import type { IRDocument } from '@figma-to-slides/shared';
import { UNCALIBRATED_DEFAULTS } from '@figma-to-slides/shared';
import { getValidAccessToken, UnauthenticatedError } from '../auth/getAccessToken.js';
import { extractSessionToken } from './auth.js';
import { getAssetStore } from '../storage/index.js';
import { createJob, getJob, pendingBatchIds } from '../jobs/jobStore.js';
import { runExportJob } from '../jobs/runner.js';
import { loadCalibration } from '../calibration/loadCalibration.js';

export const exportRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

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

  const jobId = randomUUID();
  const job = createJob(jobId, doc.slides.map((s) => s.sourceNodeId));
  const calibration = await loadCalibration();

  // Traitement asynchrone : le plugin poll GET /export/:jobId (spec §5).
  runExportJob(job, doc, accessToken, (key) => urlByAssetKey.get(key) ?? '', calibration)
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[export ${jobId}] failed`, err);
    })
    .finally(async () => {
      // Spec §5.3 : supprime l'asset dès que le batchUpdate a répondu 200.
      for (const key of urlByAssetKey.keys()) {
        await store.delete(key).catch(() => undefined);
      }
    });

  res.status(202).json({ jobId });
});

/** Spec §5: GET /export/:jobId → progression (polling). */
exportRouter.get('/export/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
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

/** Reprise ciblée des lots non appliqués (spec §7.0.6). */
exportRouter.post('/export/:jobId/retry', async (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ pendingSlideIds: pendingBatchIds(job.id) });
});
