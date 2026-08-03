#!/usr/bin/env node
import 'dotenv/config';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import type { CalibrationData, IRDocument } from '@figma-to-slides/shared';
import { UNCALIBRATED_DEFAULTS } from '@figma-to-slides/shared';
import { computeScale, rotatedTransform } from '../mapper/transform.js';
import { mapDocumentToBatches } from '../mapper/index.js';
import { buildRotationFixtureDocument, renderRotationReferencePng } from './fixtures/rotation.js';
import { buildShapesFixtureDocument, renderShapesReferencePng } from './fixtures/shapes.js';
import { applyBatch, createPresentation, getPageThumbnail, getPresentation } from '../slides/client.js';
import { buildRectsFixtureDocument, renderRectsReferencePng } from './fixtures/rects.js';
import {
  BOTTOM_RIGHT_BOX,
  buildTextInsetProbeRequests,
  PAGE_OBJECT_ID as TEXT_INSET_PAGE_ID,
  SLIDE_SIZE as TEXT_INSET_SLIDE_SIZE,
  TEXT_COLOR,
  TOP_LEFT_BOX,
} from './fixtures/textInsetProbe.js';
import { compareSsim } from './ssim.js';
import { firstColWithColor, firstRowWithColor } from './pixelMeasure.js';
import { writeCalibrationReport, type BboxDeviation, type FixtureResult, type MeasurementResult } from './report.js';

const SSIM_THRESHOLD_RECTS = 0.99;
const BBOX_THRESHOLD_PT_RECTS = 0.5;

/**
 * Seuils partagés par tout ce qui n'est PAS `01-rects` : `02-rotation` et
 * `06-shapes` (code-générées, audit 2026-08 — même logique que `01-rects` :
 * rotation/shapeType/stroke sont des champs du contrat IR déjà résolus, pas
 * une décision d'extraction Figma, donc testables sans fichier Figma réel)
 * ainsi que les fixtures de fichier ci-dessous. Moins strict que
 * `01-rects` : plus de formes/anti-aliasing, et `06-shapes` compare contre
 * un rayon de coin arrondi approximatif (voir shapes.ts). Ces fixtures sont
 * informatives — elles n'engagent pas le critère de sortie de Phase 0, qui
 * reste `01-rects` exclusivement (spec §4).
 */
const SSIM_THRESHOLD_SECONDARY = 0.95;
const BBOX_THRESHOLD_PT_SECONDARY = 1;

/**
 * Spec §9 : `04-text-multi-style`, `05-text-edge`, `07` à `13` sont censées
 * venir d'un vrai fichier Figma exporté (`fixtures/<name>.json` +
 * `fixtures/<name>.png`) — soit parce qu'elles testent une décision
 * d'extraction/résolution Figma qui ne laisse aucune trace distinctive dans
 * l'IRDocument final (substitution de police, aplatissement d'auto-layout…),
 * soit parce qu'une image de référence fidèle en pur code demanderait de
 * réimplémenter un rasterizeur de police. N'importe quelle paire posée dans
 * ce dossier est reprise automatiquement au run suivant.
 */
const FIXTURES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../fixtures');

/**
 * 1pt = 1/72 inch = 12700 EMU (English Metric Units) — même si nos requêtes
 * `batchUpdate` écrivent le `transform` en `unit: 'PT'` (mapper/transform.ts),
 * `presentations.get` renvoie les positions en EMU (confirmé en conditions
 * réelles, audit 2026-08 : écart mesuré = position attendue × 12700 pile,
 * ex. 20pt attendu → 254000 EMU réel). Sans cette conversion, le calcul
 * d'écart en points comparait des unités différentes et rapportait un écart
 * de plusieurs centaines de milliers de points sur une position en réalité
 * parfaite.
 */
const EMU_PER_PT = 12700;
function toPt(magnitude: number, unit: 'PT' | 'EMU' | undefined): number {
  return unit === 'PT' ? magnitude : magnitude / EMU_PER_PT;
}

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
  results.push(await runRotationFixture(accessToken));
  results.push(await runShapesFixture(accessToken));

  const fileFixtureNames = await discoverFileFixtures();
  for (const name of fileFixtureNames) {
    try {
      results.push(await runFileFixture(accessToken, name));
    } catch (err) {
      // Une fixture de fichier mal formée (multi-slides, images non
      // supportées, JSON invalide…) ne doit pas empêcher les autres fixtures
      // — ni celles de fichier, ni 01-rects/03-text-inset — de produire leur
      // résultat. Voir LIMITATIONS.md pour les limites actuelles de ce
      // harnais (1 slide, pas d'IRImage).
      console.error(`⚠️  Fixture "${name}" ignorée : ${(err as Error).message}`);
    }
  }

  const textInsetMeasurement = await measureTextInset(accessToken);

  const outDir = process.cwd();
  await writeCalibrationReport(path.join(outDir, 'calibration-report.html'), results, [textInsetMeasurement.report]);

  const calibration: CalibrationData = {
    ...UNCALIBRATED_DEFAULTS,
    textInset: textInsetMeasurement.textInset,
    measuredAt: new Date().toISOString(),
  };
  await writeFile(path.join(outDir, 'calibration.json'), JSON.stringify(calibration, null, 2), 'utf8');

  // eslint-disable-next-line no-console
  console.log(
    `\ncalibration-report.html écrit. SSIM(01-rects) = ${rectsResult.ssimScore.toFixed(4)} ` +
      `(seuil ${SSIM_THRESHOLD_RECTS}). textInset mesuré : ` +
      `left=${textInsetMeasurement.textInset.left.toFixed(2)}pt right=${textInsetMeasurement.textInset.right.toFixed(2)}pt ` +
      `top=${textInsetMeasurement.textInset.top.toFixed(2)}pt bottom=${textInsetMeasurement.textInset.bottom.toFixed(2)}pt ` +
      `— écrit dans calibration.json. NOTE : roundRectRadiusRatio / defaultOutlineWeightPt / lineSpacingBaseline ` +
      `restent des valeurs par défaut non mesurées ET actuellement non consommées par le mapper (champs morts, voir ` +
      `LIMITATIONS.md) — ne pas prioriser leur calibration tant qu'ils ne sont branchés nulle part.`,
  );

  for (const r of results) {
    if (r.name === '01-rects') continue;
    const secondaryPassed = r.ssimScore >= r.ssimThreshold && r.bboxDeviations.every((d) => d.deviationPt <= r.bboxThresholdPt);
    console.log(`${secondaryPassed ? '✅' : '⚠️ '} ${r.name} : SSIM = ${r.ssimScore.toFixed(4)} (seuil ${r.ssimThreshold}, informatif — voir calibration-report.html).`);
  }
  if (fileFixtureNames.length === 0) {
    console.log(
      `\nAucune fixture de fichier trouvée dans ${FIXTURES_DIR} — dépose des paires <nom>.json/<nom>.png ` +
        '(spec §9, ex. "04-text-multi-style") pour qu\'elles soient reprises automatiquement au prochain run.',
    );
  }

  const passed = rectsResult.ssimScore >= SSIM_THRESHOLD_RECTS && rectsResult.bboxDeviations.every((d) => d.deviationPt <= BBOX_THRESHOLD_PT_RECTS);
  if (!passed) {
    console.error('❌ Critère de sortie de Phase 0 non atteint (spec §4). Voir calibration-report.html.');
    process.exitCode = 1;
  } else {
    console.log('✅ Critère de sortie de Phase 0 atteint (SSIM ≥ 0.99, écart ≤ 0.5pt).');
  }
}

/** Toute paire `<nom>.json` + `<nom>.png` posée dans `fixtures/` (racine du repo) — voir spec §9. */
async function discoverFileFixtures(): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(FIXTURES_DIR);
  } catch {
    return [];
  }
  const jsonNames = new Set(entries.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length)));
  const pngNames = new Set(entries.filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -'.png'.length)));
  return [...jsonNames].filter((n) => pngNames.has(n)).sort();
}

/**
 * Fait tourner une fixture décrite par un vrai `IRDocument` exporté depuis
 * Figma (`fixtures/<name>.json`) contre une image de référence tout aussi
 * réelle (`fixtures/<name>.png`, export natif Figma du même frame) — même
 * pipeline que `runRectsFixture`, généralisé.
 *
 * Limites actuelles (voir LIMITATIONS.md) : une seule slide par fixture, et
 * aucun élément `image` — l'hébergement d'un asset public depuis ce script
 * autonome (sans backend HTTP qui tourne) n'est pas encore câblé.
 */
async function runFileFixture(accessToken: string, name: string): Promise<FixtureResult> {
  const doc = JSON.parse(await readFile(path.join(FIXTURES_DIR, `${name}.json`), 'utf8')) as IRDocument;
  const referencePng = await readFile(path.join(FIXTURES_DIR, `${name}.png`));

  if (doc.slides.length !== 1) {
    throw new Error(`${doc.slides.length} slides — ce harnais ne gère pour l'instant que les fixtures à 1 slide.`);
  }
  if (doc.slides[0].elements.some((el) => el.kind === 'image')) {
    throw new Error("contient un élément image — l'hébergement d'asset public n'est pas encore câblé dans ce script autonome.");
  }

  return runGeometryFixture(accessToken, doc, referencePng, name, SSIM_THRESHOLD_SECONDARY, BBOX_THRESHOLD_PT_SECONDARY);
}

/**
 * Fixture `03-text-inset` — mesure la vraie marge interne des TEXT_BOX
 * Slides par balayage de pixels (voir fixtures/textInsetProbe.ts pour le
 * détail de la géométrie et du choix des couleurs de contraste).
 */
async function measureTextInset(accessToken: string): Promise<{ textInset: CalibrationData['textInset']; report: MeasurementResult }> {
  const { presentationId, firstSlideObjectId } = await createPresentation(
    accessToken,
    'f2s-calibration-03-text-inset',
    TEXT_INSET_SLIDE_SIZE,
  );
  await applyBatch(accessToken, presentationId, { sourceSlideId: '__text_inset__', requests: buildTextInsetProbeRequests() });
  await applyBatch(accessToken, presentationId, {
    sourceSlideId: '__default__',
    requests: [{ deleteObject: { objectId: firstSlideObjectId } }],
  }).catch(() => undefined);

  const thumb = await getPageThumbnail(accessToken, presentationId, TEXT_INSET_PAGE_ID);
  const renderedPng = Buffer.from(await (await fetch(thumb.contentUrl)).arrayBuffer());
  const img = PNG.sync.read(renderedPng);

  const pxPerPtX = img.width / TEXT_INSET_SLIDE_SIZE.widthPt;
  const pxPerPtY = img.height / TEXT_INSET_SLIDE_SIZE.heightPt;
  const textRgb255 = {
    r: Math.round(TEXT_COLOR.red * 255),
    g: Math.round(TEXT_COLOR.green * 255),
    b: Math.round(TEXT_COLOR.blue * 255),
  };
  // Généreuse : on veut détecter jusqu'au pixel anti-aliasé le plus léger du
  // bord du glyphe (distance max possible face au gris de fond ≈ 300).
  const COLOR_TOLERANCE = 150;

  const tl = TOP_LEFT_BOX.rect;
  const tlPx = { x: tl.x * pxPerPtX, y: tl.y * pxPerPtY, w: tl.w * pxPerPtX, h: tl.h * pxPerPtY };
  const topRow = firstRowWithColor(img, Math.floor(tlPx.y), Math.ceil(tlPx.y + tlPx.h), Math.floor(tlPx.x), Math.ceil(tlPx.x + tlPx.w), textRgb255, COLOR_TOLERANCE);
  const leftCol = firstColWithColor(img, Math.floor(tlPx.x), Math.ceil(tlPx.x + tlPx.w), Math.floor(tlPx.y), Math.ceil(tlPx.y + tlPx.h), textRgb255, COLOR_TOLERANCE);

  const br = BOTTOM_RIGHT_BOX.rect;
  const brPx = { x: br.x * pxPerPtX, y: br.y * pxPerPtY, w: br.w * pxPerPtX, h: br.h * pxPerPtY };
  const bottomRow = firstRowWithColor(img, Math.ceil(brPx.y + brPx.h), Math.floor(brPx.y), Math.floor(brPx.x), Math.ceil(brPx.x + brPx.w), textRgb255, COLOR_TOLERANCE);
  const rightCol = firstColWithColor(img, Math.ceil(brPx.x + brPx.w), Math.floor(brPx.x), Math.floor(brPx.y), Math.ceil(brPx.y + brPx.h), textRgb255, COLOR_TOLERANCE);

  if (topRow === undefined || leftCol === undefined || bottomRow === undefined || rightCol === undefined) {
    throw new Error(
      "measureTextInset : le glyphe de test (\"H\" rouge) n'a pas été détecté dans le rendu Slides — vérifier " +
        'calibration-report.html (image "Rendu Slides" de la section 03-text-inset) et ajuster COLOR_TOLERANCE ou la géométrie des boîtes si besoin.',
    );
  }

  const textInset = {
    top: Math.max(0, (topRow - tlPx.y) / pxPerPtY),
    left: Math.max(0, (leftCol - tlPx.x) / pxPerPtX),
    bottom: Math.max(0, (brPx.y + brPx.h - bottomRow) / pxPerPtY),
    right: Math.max(0, (brPx.x + brPx.w - rightCol) / pxPerPtX),
  };

  return {
    textInset,
    report: {
      name: '03-text-inset',
      description:
        'Marge interne réelle des TEXT_BOX Slides (spec §4), mesurée par balayage de pixels sur un glyphe "H" rouge gras dans deux boîtes à fond gris (ancrage haut-gauche pour left/top, bas-droite pour right/bottom) plutôt que comparée à une image de référence synthétique.',
      renderedPng,
      rows: [
        { label: 'left', valuePt: textInset.left },
        { label: 'right', valuePt: textInset.right },
        { label: 'top', valuePt: textInset.top },
        { label: 'bottom', valuePt: textInset.bottom },
      ],
    },
  };
}

async function runRectsFixture(accessToken: string): Promise<FixtureResult> {
  const doc = buildRectsFixtureDocument();
  const referencePng = renderRectsReferencePng(2);
  return runGeometryFixture(accessToken, doc, referencePng, '01-rects', SSIM_THRESHOLD_RECTS, BBOX_THRESHOLD_PT_RECTS);
}

async function runRotationFixture(accessToken: string): Promise<FixtureResult> {
  const doc = buildRotationFixtureDocument();
  const referencePng = renderRotationReferencePng(2);
  return runGeometryFixture(accessToken, doc, referencePng, '02-rotation', SSIM_THRESHOLD_SECONDARY, BBOX_THRESHOLD_PT_SECONDARY);
}

async function runShapesFixture(accessToken: string): Promise<FixtureResult> {
  const doc = buildShapesFixtureDocument();
  const referencePng = renderShapesReferencePng(2);
  return runGeometryFixture(accessToken, doc, referencePng, '06-shapes', SSIM_THRESHOLD_SECONDARY, BBOX_THRESHOLD_PT_SECONDARY);
}

/**
 * Cœur commun à toute fixture "comparaison géométrique" (position + SSIM
 * contre une image de référence) : crée la présentation, applique le lot
 * unique de la slide, récupère la miniature réelle et les transforms
 * réellement appliquées, calcule écarts de position + SSIM. `01-rects`
 * (référence synthétique) et les fixtures de fichier (référence = export
 * Figma réel) partagent exactement cette mécanique — seule la provenance du
 * document et de l'image change.
 */
async function runGeometryFixture(
  accessToken: string,
  doc: IRDocument,
  referencePng: Buffer,
  name: string,
  ssimThreshold: number,
  bboxThresholdPt: number,
): Promise<FixtureResult> {
  const { presentationId, firstSlideObjectId } = await createPresentation(accessToken, doc.presentationTitle, doc.slideSize);
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
    slides: {
      objectId: string;
      pageElements: { objectId: string; transform: { translateX: number; translateY: number; unit?: 'PT' | 'EMU' } }[];
    }[];
  };
  const page = presentation.slides.find((p) => p.objectId === pageObjectId);

  const { scale, offsetXPt, offsetYPt } = computeScale(doc.slides[0].frameSize, doc.slideSize);
  const bboxDeviations: BboxDeviation[] = doc.slides[0].elements.map((el) => {
    // `rotatedTransform` plutôt que `rect.x*scale+offset` brut : pour un
    // élément tourné (fixture 02-rotation), translateX/Y attendu n'est PAS
    // le coin haut-gauche non tourné — c'est le même calcul que
    // mapper/shapes.ts, réutilisé ici pour ne pas comparer deux géométries
    // différentes (rotation=0 retombe sur l'identité, donc aucun changement
    // pour 01-rects).
    const expected = rotatedTransform(el.rect.x * scale + offsetXPt, el.rect.y * scale + offsetYPt, el.rect.w * scale, el.rect.h * scale, el.rotation);
    const expectedXPt = expected.translateX;
    const expectedYPt = expected.translateY;
    const actual = page?.pageElements.find((pe) => pe.objectId === el.id);
    const actualXPt = actual ? toPt(actual.transform.translateX, actual.transform.unit) : NaN;
    const actualYPt = actual ? toPt(actual.transform.translateY, actual.transform.unit) : NaN;
    const deviationPt = Math.hypot(actualXPt - expectedXPt, actualYPt - expectedYPt);
    return { objectId: el.id, expectedXPt, expectedYPt, actualXPt, actualYPt, deviationPt };
  });

  const { score, diffPng } = compareSsim(referencePng, renderedPng);

  return { name, ssimScore: score, referencePng, renderedPng, diffPng, bboxDeviations, ssimThreshold, bboxThresholdPt };
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
