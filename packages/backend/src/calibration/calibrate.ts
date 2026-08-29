#!/usr/bin/env node
import 'dotenv/config';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import type { CalibrationData, IRDocument, IRSlide } from '@figma-to-slides/shared';
import { applyTextInset, computeScale, rotatedTransform } from '../mapper/transform.js';
import { mapDocumentToBatches, type AssetUrlResolver } from '../mapper/index.js';
import { loadCalibration } from './loadCalibration.js';
import { env } from '../env.js';
import { getAssetStore } from '../storage/index.js';
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

  // Charge le VRAI calibration.json déjà mesuré s'il existe (même fonction
  // que le backend de production, routes/export.ts) — sans ça, ce script
  // testait ses propres fixtures texte contre les valeurs par défaut non
  // mesurées (`UNCALIBRATED_DEFAULTS.textInset`, 7.2/3.6) plutôt que contre
  // le vrai `textInset` déjà mesuré par un run précédent, faussant tableau
  // d'écarts ET rendu réel des fixtures texte (audit 2026-08).
  const loadedCalibration = await loadCalibration();

  const results: FixtureResult[] = [];

  const rectsResult = await runRectsFixture(accessToken, loadedCalibration);
  results.push(rectsResult);
  results.push(await runRotationFixture(accessToken, loadedCalibration));
  results.push(await runShapesFixture(accessToken, loadedCalibration));

  const fileFixtureNames = await discoverFileFixtures();
  for (const name of fileFixtureNames) {
    try {
      const doc = JSON.parse(await readFile(path.join(FIXTURES_DIR, `${name}.json`), 'utf8')) as IRDocument;
      // `13-batch` (spec §9) est la seule fixture à plusieurs slides — un
      // IRDocument normal en a toujours exactement 1 (une frame = une
      // slide). Router sur cette seule propriété évite d'avoir à nommer les
      // fixtures multi-slides différemment.
      if (doc.slides.length > 1) {
        results.push(...(await runBatchFixture(accessToken, name, doc, loadedCalibration)));
      } else {
        results.push(await runFileFixture(accessToken, name, doc, loadedCalibration));
      }
    } catch (err) {
      // Une fixture de fichier mal formée (JSON invalide, image référencée
      // sans fichier déposé…) ne doit pas empêcher les autres fixtures —
      // ni celles de fichier, ni 01-rects/03-text-inset — de produire leur
      // résultat.
      console.error(`⚠️  Fixture "${name}" ignorée : ${(err as Error).message}`);
    }
  }

  // Les 3 fixtures code-générées sont poussées dans `results` avant la boucle
  // de découverte de fichiers (ordre d'exécution, pas d'affichage) — sans ce
  // tri, le rapport et la console les affichaient AVANT 03/04/05 alors que
  // leur numéro (01/02/06) les place ailleurs dans le spec §9. Le préfixe
  // "NN-" étant toujours sur 2 chiffres, un tri alphabétique suffit à
  // retrouver l'ordre numérique 01→12.
  results.sort((a, b) => a.name.localeCompare(b.name));

  const textInsetMeasurement = await measureTextInset(accessToken);

  const outDir = process.cwd();
  await writeCalibrationReport(path.join(outDir, 'calibration-report.html'), results, [textInsetMeasurement.report]);

  const calibration: CalibrationData = {
    ...loadedCalibration,
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
    const bboxPassed = r.bboxDeviations.every((d) => d.deviationPt <= r.bboxThresholdPt);
    // Le SSIM n'est PAS un signal fiable sur du texte réel (moteurs de rendu
    // de police différents entre Figma et Slides — audit 2026-08, voir
    // FixtureResult.containsText) : seul l'écart de position engage le
    // statut pass/fail pour ces fixtures-là.
    const secondaryPassed = r.containsText ? bboxPassed : r.ssimScore >= r.ssimThreshold && bboxPassed;
    const ssimLabel = r.containsText ? `SSIM = ${r.ssimScore.toFixed(4)} (informatif, texte réel — voir écart de position)` : `SSIM = ${r.ssimScore.toFixed(4)} (seuil ${r.ssimThreshold}, informatif)`;
    console.log(`${secondaryPassed ? '✅' : '⚠️ '} ${r.name} : ${ssimLabel} — voir calibration-report.html.`);
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
  // Une fixture normale a UNE référence `<nom>.png`. Une fixture multi-slides
  // (13-batch) a une référence PAR slide, `<nom>-0.png`, `<nom>-1.png`... —
  // la présence de la première (`<nom>-0.png`) suffit à la repérer ici,
  // `runBatchFixture` lit le nombre exact de slides depuis le JSON lui-même.
  return [...jsonNames].filter((n) => pngNames.has(n) || pngNames.has(`${n}-0`)).sort();
}

/** Remplace tout caractère invalide dans un nom de fichier Windows/Mac/Linux par `_` — DOIT rester identique à la sanitisation faite côté plugin (ui.tsx, téléchargement des assets debug), sinon les noms ne matchent plus. */
function sanitizeAssetFileName(assetKey: string): string {
  return assetKey.replace(/[^a-z0-9-_]+/gi, '_');
}

/**
 * Upload (spec §5.3, `getAssetStore()`) tout asset référencé par
 * `imageElements` vers le VRAI store d'assets de production, pour obtenir
 * une URL que l'API Slides peut réellement fetcher — un fichier local ou
 * `localhost` n'est joignable ni depuis Vercel ni depuis Google (voir
 * LIMITATIONS.md). Fichier attendu : `fixtures/<name>-assets/<assetKey-
 * sanitisé>.png` (téléchargé automatiquement par "Download IR JSON" côté
 * plugin). Partagé par `runFileFixture` (1 slide) et `runBatchFixture`
 * (plusieurs) — les deux uploadent, dans les deux cas, TOUS les assets de
 * TOUTES leurs slides d'un coup avant de rien créer côté Slides.
 *
 * Le `cleanup()` retourné doit être appelé une fois la fixture terminée
 * (best-effort : ne fait jamais échouer l'appelant si la suppression rate) —
 * sinon ces images de test s'accumulent indéfiniment dans le Blob store de
 * PRODUCTION (même token que les exports réels des utilisateurs).
 */
async function prepareFixtureAssets(name: string, imageElements: { assetKey: string }[]): Promise<{ resolveAssetUrl: AssetUrlResolver; cleanup: () => Promise<void> }> {
  if (imageElements.length === 0) {
    return { resolveAssetUrl: () => '', cleanup: async () => undefined };
  }

  if (env.assets.driver !== 'vercel-blob') {
    throw new Error(
      `contient ${imageElements.length} élément(s) image — configure ASSET_STORAGE_DRIVER=vercel-blob et ` +
        'BLOB_READ_WRITE_TOKEN=<ton token, Vercel → Storage → Blob> dans ton environnement avant de relancer ' +
        `(ASSET_STORAGE_DRIVER actuel : ${env.assets.driver}).`,
    );
  }

  const assetStore = getAssetStore();
  const assetsDir = path.join(FIXTURES_DIR, `${name}-assets`);
  const uploadedKeys: string[] = [];
  const urlByAssetKey = new Map<string, string>();
  const cleanup = async (): Promise<void> => {
    await Promise.all(uploadedKeys.map((k) => assetStore.delete(k).catch(() => undefined)));
  };

  try {
    for (const el of imageElements) {
      const fileName = `${sanitizeAssetFileName(el.assetKey)}.png`;
      let bytes: Buffer;
      try {
        bytes = await readFile(path.join(assetsDir, fileName));
      } catch {
        throw new Error(
          `image "${el.assetKey}" référencée mais fichier introuvable : fixtures/${name}-assets/${fileName} ` +
            '("Download IR JSON" côté plugin télécharge aussi ce fichier — vérifie qu\'il a bien été déplacé là.)',
        );
      }
      await assetStore.put(el.assetKey, bytes, 'image/png');
      uploadedKeys.push(el.assetKey);
      urlByAssetKey.set(el.assetKey, await assetStore.getSignedUrl(el.assetKey));
    }
  } catch (err) {
    // Une image sur 7 manquante ne doit pas laisser les 6 déjà uploadées
    // trainer dans le Blob store — nettoyage avant de faire remonter l'erreur.
    await cleanup();
    throw err;
  }

  return { resolveAssetUrl: (key) => urlByAssetKey.get(key) ?? '', cleanup };
}

/**
 * Fait tourner une fixture décrite par un vrai `IRDocument` exporté depuis
 * Figma (`fixtures/<name>.json`, une seule slide) contre une image de
 * référence tout aussi réelle (`fixtures/<name>.png`, export natif Figma du
 * même frame) — même pipeline que `runRectsFixture`, généralisé.
 */
async function runFileFixture(accessToken: string, name: string, doc: IRDocument, calibration: CalibrationData): Promise<FixtureResult> {
  const referencePng = await readFile(path.join(FIXTURES_DIR, `${name}.png`));
  const imageElements = doc.slides[0].elements.filter((el) => el.kind === 'image');
  const { resolveAssetUrl, cleanup } = await prepareFixtureAssets(name, imageElements);
  try {
    return await runGeometryFixture(accessToken, doc, referencePng, name, SSIM_THRESHOLD_SECONDARY, BBOX_THRESHOLD_PT_SECONDARY, calibration, resolveAssetUrl);
  } finally {
    await cleanup();
  }
}

/**
 * `13-batch` (spec §9) — variante multi-slides : un seul `IRDocument` avec
 * PLUSIEURS slides, exportées ensemble dans UNE présentation comme un vrai
 * deck (pas une présentation par slide), chaque slide comparée à SA PROPRE
 * image de référence `fixtures/<name>-<i>.png` (i = index dans
 * `doc.slides` trié par `.order`, PAS l'ordre d'apparition dans le JSON).
 *
 * L'intérêt par rapport aux fixtures à 1 slide : vérifier que Slides crée
 * bien AUTANT de slides que prévu, DANS le bon ordre. Un décalage ou une
 * perte de slide (ex. lot > `MAX_REQUESTS_PER_BATCH`, erreur silencieuse
 * dans un batch) se traduirait par un nombre de pages différent (détecté
 * explicitement ci-dessous) ou par une slide comparée à la mauvaise
 * référence (bbox/SSIM très dégradés sur cette slide précise).
 */
async function runBatchFixture(accessToken: string, name: string, doc: IRDocument, calibration: CalibrationData): Promise<FixtureResult[]> {
  const sortedSlides = [...doc.slides].sort((a, b) => a.order - b.order);
  const imageElements = sortedSlides.flatMap((s) => s.elements.filter((el) => el.kind === 'image'));
  const { resolveAssetUrl, cleanup } = await prepareFixtureAssets(name, imageElements);

  try {
    const { presentationId, firstSlideObjectId } = await createPresentation(accessToken, doc.presentationTitle, doc.slideSize);
    for (const batch of mapDocumentToBatches(doc, resolveAssetUrl, calibration)) {
      await applyBatch(accessToken, presentationId, batch);
    }
    await applyBatch(accessToken, presentationId, {
      sourceSlideId: '__default__',
      requests: [{ deleteObject: { objectId: firstSlideObjectId } }],
    }).catch(() => undefined);

    const presentation = (await getPresentation(accessToken, presentationId)) as { slides: ActualSlidesPage[] };
    if (presentation.slides.length !== sortedSlides.length) {
      throw new Error(
        `${sortedSlides.length} slides attendues, ${presentation.slides.length} trouvées dans la présentation réelle ` +
          '— une slide a été perdue ou dupliquée pendant l\'export.',
      );
    }

    const results: FixtureResult[] = [];
    for (let i = 0; i < sortedSlides.length; i++) {
      const page = presentation.slides[i];
      const referencePng = await readFile(path.join(FIXTURES_DIR, `${name}-${i}.png`));
      const thumb = await getPageThumbnail(accessToken, presentationId, page.objectId);
      const renderedPng = Buffer.from(await (await fetch(thumb.contentUrl)).arrayBuffer());
      results.push(
        compareSlideToReference(
          `${name}-${String(i).padStart(2, '0')}`,
          sortedSlides[i],
          doc.slideSize,
          page,
          referencePng,
          renderedPng,
          SSIM_THRESHOLD_SECONDARY,
          BBOX_THRESHOLD_PT_SECONDARY,
          calibration,
        ),
      );
    }
    return results;
  } finally {
    await cleanup();
  }
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

async function runRectsFixture(accessToken: string, calibration: CalibrationData): Promise<FixtureResult> {
  const doc = buildRectsFixtureDocument();
  const referencePng = renderRectsReferencePng(2);
  return runGeometryFixture(accessToken, doc, referencePng, '01-rects', SSIM_THRESHOLD_RECTS, BBOX_THRESHOLD_PT_RECTS, calibration);
}

async function runRotationFixture(accessToken: string, calibration: CalibrationData): Promise<FixtureResult> {
  const doc = buildRotationFixtureDocument();
  const referencePng = renderRotationReferencePng(2);
  return runGeometryFixture(accessToken, doc, referencePng, '02-rotation', SSIM_THRESHOLD_SECONDARY, BBOX_THRESHOLD_PT_SECONDARY, calibration);
}

async function runShapesFixture(accessToken: string, calibration: CalibrationData): Promise<FixtureResult> {
  const doc = buildShapesFixtureDocument();
  const referencePng = renderShapesReferencePng(2);
  return runGeometryFixture(accessToken, doc, referencePng, '06-shapes', SSIM_THRESHOLD_SECONDARY, BBOX_THRESHOLD_PT_SECONDARY, calibration);
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
interface ActualSlidesPage {
  objectId: string;
  pageElements: { objectId: string; transform: { translateX: number; translateY: number; unit?: 'PT' | 'EMU' } }[];
}

async function runGeometryFixture(
  accessToken: string,
  doc: IRDocument,
  referencePng: Buffer,
  name: string,
  ssimThreshold: number,
  bboxThresholdPt: number,
  calibration: CalibrationData,
  resolveAssetUrl: AssetUrlResolver = () => '',
): Promise<FixtureResult> {
  const { presentationId, firstSlideObjectId } = await createPresentation(accessToken, doc.presentationTitle, doc.slideSize);
  const [batch] = mapDocumentToBatches(doc, resolveAssetUrl, calibration);
  await applyBatch(accessToken, presentationId, batch);
  await applyBatch(accessToken, presentationId, {
    sourceSlideId: '__default__',
    requests: [{ deleteObject: { objectId: firstSlideObjectId } }],
  }).catch(() => undefined);

  const pageObjectId = batch.requests[0] && 'createSlide' in batch.requests[0] ? batch.requests[0].createSlide.objectId : '';
  const thumb = await getPageThumbnail(accessToken, presentationId, pageObjectId);
  const renderedPng = Buffer.from(await (await fetch(thumb.contentUrl)).arrayBuffer());

  const presentation = (await getPresentation(accessToken, presentationId)) as { slides: ActualSlidesPage[] };
  const page = presentation.slides.find((p) => p.objectId === pageObjectId);

  return compareSlideToReference(name, doc.slides[0], doc.slideSize, page, referencePng, renderedPng, ssimThreshold, bboxThresholdPt, calibration);
}

/**
 * Cœur commun à toute comparaison "une slide contre sa référence" (position
 * + SSIM) — extrait pour être partagé entre `runGeometryFixture` (1 slide,
 * 1 présentation) et `runBatchFixture` (plusieurs slides, 1 présentation,
 * cette fonction appelée une fois par slide).
 */
function compareSlideToReference(
  name: string,
  slide: IRSlide,
  slideSize: IRDocument['slideSize'],
  page: ActualSlidesPage | undefined,
  referencePng: Buffer,
  renderedPng: Buffer,
  ssimThreshold: number,
  bboxThresholdPt: number,
  calibration: CalibrationData,
): FixtureResult {
  const { scale, offsetXPt, offsetYPt } = computeScale(slide.frameSize, slideSize);
  const bboxDeviations: BboxDeviation[] = slide.elements.map((el) => {
    // Deux corrections par rapport à une comparaison naïve `rect.x*scale+offset` :
    // - `rotatedTransform` plutôt que le coin haut-gauche non tourné, pour
    //   un élément tourné (02-rotation) — même calcul que mapper/shapes.ts ;
    //   rotation=0 retombe sur l'identité, donc aucun changement pour 01-rects.
    // - pour un texte, `mapText` décale et agrandit la boîte de `textInset`
    //   AVANT même de considérer la rotation (`applyTextInset`, en PX comme
    //   `rect`) — comparer au `rect` brut ferait apparaître un "écart" de la
    //   taille exacte de l'inset (audit 2026-08 : c'est précisément ce qui
    //   rendait le tableau d'écarts illisible sur les fixtures texte, alors
    //   que le rendu réel était correct).
    const box =
      el.kind === 'text'
        ? applyTextInset(el.rect, {
            left: calibration.textInset.left / scale,
            right: calibration.textInset.right / scale,
            top: calibration.textInset.top / scale,
            bottom: calibration.textInset.bottom / scale,
          })
        : el.rect;
    const expected = rotatedTransform(box.x * scale + offsetXPt, box.y * scale + offsetYPt, box.w * scale, box.h * scale, el.rotation);
    const expectedXPt = expected.translateX;
    const expectedYPt = expected.translateY;
    const actual = page?.pageElements.find((pe) => pe.objectId === el.id);
    const actualXPt = actual ? toPt(actual.transform.translateX, actual.transform.unit) : NaN;
    const actualYPt = actual ? toPt(actual.transform.translateY, actual.transform.unit) : NaN;
    const deviationPt = Math.hypot(actualXPt - expectedXPt, actualYPt - expectedYPt);
    return { objectId: el.id, expectedXPt, expectedYPt, actualXPt, actualYPt, deviationPt };
  });

  const { score, diffPng } = compareSsim(referencePng, renderedPng);

  const containsText = slide.elements.some((el) => el.kind === 'text');
  return { name, ssimScore: score, referencePng, renderedPng, diffPng, bboxDeviations, ssimThreshold, bboxThresholdPt, containsText };
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
     gcloud / OAuth Playground avec le scope :
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
