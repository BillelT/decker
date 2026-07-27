import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CalibrationData } from '@figma-to-slides/shared';
import { UNCALIBRATED_DEFAULTS } from '@figma-to-slides/shared';

const CALIBRATION_PATH = path.resolve(process.cwd(), 'calibration.json');

let cached: CalibrationData | undefined;

/**
 * Charge `calibration.json` produit par `npm run calibrate` (spec §4).
 * Retombe sur des valeurs prudentes non calibrées si le fichier n'existe
 * pas encore — à ne jamais considérer comme pixel-perfect (voir
 * UNCALIBRATED_DEFAULTS dans packages/shared).
 */
export async function loadCalibration(): Promise<CalibrationData> {
  if (cached) return cached;
  try {
    const raw = await readFile(CALIBRATION_PATH, 'utf8');
    cached = JSON.parse(raw) as CalibrationData;
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[calibration] calibration.json introuvable — utilisation de valeurs par défaut non calibrées.');
    cached = UNCALIBRATED_DEFAULTS;
  }
  return cached;
}
