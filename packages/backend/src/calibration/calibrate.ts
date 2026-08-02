#!/usr/bin/env node
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CalibrationData } from '@figma-to-slides/shared';
import { UNCALIBRATED_DEFAULTS } from '@figma-to-slides/shared';
import { computeScale } from '../mapper/transform.js';
import { mapDocumentToBatches } from '../mapper/index.js';
import { applyBatch, createPresentation, getPageThumbnail, getPresentation } from '../slides/client.js';
import { buildRectsFixtureDocument, renderRectsReferencePng } from './fixtures/rects.js';
import { compareSsim } from './ssim.js';
import { writeCalibrationReport, type BboxDeviation, type FixtureResult } from './report.js';

const SSIM_THRESHOLD_RECTS = 0.99;
const BBOX_THRESHOLD_PT_RECTS = 0.5;

async function main(): Promise<void> {
  const sessionToken = process.env.F2S_SESSION_TOKEN;
  if (!sessionToken) {
    printMissingCredentialsHelp();
    process.exitCode = 1;
    return;
  }

  // Import dynamique pour éviter de charger le store de session tant qu'on
  // n'a pas confirmé qu'un token est fourni (le store exige
  // SESSION_ENCRYPTION_KEY, sans intérêt pour un run purement synthétique
  // qui reçoit déjà un access token prêt à l'emploi côté F2S_SESSION_TOKEN).
  const accessToken = sessionToken;

  const results: FixtureResult[] = [];

  const rectsResult = await runRectsFixture(accessToken);
  results.push(rectsResult);

  const outDir = process.cwd();
  await writeCalibrationReport(path.join(outDir, 'calibration-report.html'), results);

  const calibration: CalibrationData = {
    ...UNCALIBRATED_DEFAULTS,
    measuredAt: new Date().toISOString(),
  };
  await writeFile(path.join(outDir, 'calibration.json'), JSON.stringify(calibration, null, 2), 'utf8');

  // eslint-disable-next-line no-console
  console.log(
    `\ncalibration-report.html écrit. SSIM(01-rects) = ${rectsResult.ssimScore.toFixed(4)} ` +
      `(seuil ${SSIM_THRESHOLD_RECTS}). NOTE : textInset / roundRectRadiusRatio / lineSpacingBaseline ` +
      `ne sont PAS mesurés par ce run — calibration.json contient encore UNCALIBRATED_DEFAULTS pour ces champs. ` +
      `Voir LIMITATIONS.md.`,
  );

  const passed = rectsResult.ssimScore >= SSIM_THRESHOLD_RECTS && rectsResult.bboxDeviations.every((d) => d.deviationPt <= BBOX_THRESHOLD_PT_RECTS);
  if (!passed) {
    console.error('❌ Critère de sortie de Phase 0 non atteint (spec §4). Voir calibration-report.html.');
    process.exitCode = 1;
  } else {
    console.log('✅ Critère de sortie de Phase 0 atteint (SSIM ≥ 0.99, écart ≤ 0.5pt).');
  }
}

async function runRectsFixture(accessToken: string): Promise<FixtureResult> {
  const doc = buildRectsFixtureDocument();
  const referencePng = renderRectsReferencePng(2);

  const { presentationId, firstSlideObjectId } = await createPresentation(accessToken, doc.presentationTitle);
  const [batch] = mapDocumentToBatches(doc, () => '', UNCALIBRATED_DEFAULTS);
  await applyBatch(accessToken, presentationId, batch);
  await applyBatch(accessToken, presentationId, {
    sourceSlideId: '__default__',
    requests: [{ deleteObject: { objectId: firstSlideObjectId } }],
  }).catch(() => undefined);

  const pageObjectId = batch.requests[0] && 'createSlide' in batch.requests[0] ? batch.requests[0].createSlide.objectId : '';
  const thumb = await getPageThumbnail(accessToken, presentationId, pageObjectId);
  const renderedPng = Buffer.from(await (await fetch(thumb.contentUrl)).arrayBuffer());

  const presentation = (await getPresentation(accessToken, presentationId)) as {
    slides: { objectId: string; pageElements: { objectId: string; transform: { translateX: number; translateY: number } }[] }[];
  };
  const page = presentation.slides.find((p) => p.objectId === pageObjectId);

  const { scale, offsetXPt, offsetYPt } = computeScale(doc.slides[0].frameSize, doc.slideSize);
  const bboxDeviations: BboxDeviation[] = doc.slides[0].elements.map((el) => {
    const expectedXPt = el.rect.x * scale + offsetXPt;
    const expectedYPt = el.rect.y * scale + offsetYPt;
    const actual = page?.pageElements.find((pe) => pe.objectId === el.id);
    const actualXPt = actual?.transform.translateX ?? NaN;
    const actualYPt = actual?.transform.translateY ?? NaN;
    const deviationPt = Math.hypot(actualXPt - expectedXPt, actualYPt - expectedYPt);
    return { objectId: el.id, expectedXPt, expectedYPt, actualXPt, actualYPt, deviationPt };
  });

  const { score, diffPng } = compareSsim(referencePng, renderedPng);

  return {
    name: '01-rects',
    ssimScore: score,
    referencePng,
    renderedPng,
    diffPng,
    bboxDeviations,
    ssimThreshold: SSIM_THRESHOLD_RECTS,
    bboxThresholdPt: BBOX_THRESHOLD_PT_RECTS,
  };
}

function printMissingCredentialsHelp(): void {
  console.error(`
Le harnais de calibration (spec §4) a besoin d'un access token Google valide
pour créer une vraie présentation et mesurer le rendu réel de l'API Slides —
ceci ne peut pas être simulé sans appel réseau authentifié.

Étapes :
  1. Démarrer le backend (npm run dev --workspace packages/backend) avec un
     GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET valides (voir README.md).
  2. Compléter le flow OAuth (POST /auth/google puis /auth/callback) pour
     obtenir un sessionToken, ou générer directement un access token via
     gcloud / OAuth Playground avec les scopes :
       - https://www.googleapis.com/auth/presentations
       - https://www.googleapis.com/auth/drive.file
  3. Relancer avec :
       F2S_SESSION_TOKEN=<access_token> npm run calibrate

Sans cela, ce script s'arrête ici plutôt que de produire un faux rapport.
`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
