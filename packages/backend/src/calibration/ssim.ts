import { PNG } from 'pngjs';
import { ssim as computeSsim } from 'ssim.js';

export interface SsimResult {
  score: number;
  diffPng: Buffer;
}

/**
 * Spec §4 — SSIM global entre le rendu Slides et l'export Figma (ou, pour
 * les fixtures synthétiques de Phase 0, entre le rendu Slides et l'image de
 * référence générée). Les deux PNG doivent avoir les mêmes dimensions —
 * `alignImages` gère le redimensionnement au plus petit dénominateur commun.
 */
export function compareSsim(pngA: Buffer, pngB: Buffer): SsimResult {
  const a = PNG.sync.read(pngA);
  const b = PNG.sync.read(pngB);
  const { imgA, imgB, width, height } = alignImages(a, b);

  const { mssim, ssim_map: ssimMap } = computeSsim(
    { data: imgA, width, height },
    { data: imgB, width, height },
  );

  const diff = new PNG({ width, height });
  paintDiff(diff, ssimMap, width, height);

  return { score: mssim, diffPng: PNG.sync.write(diff) };
}

function alignImages(a: PNG, b: PNG): { imgA: Uint8ClampedArray; imgB: Uint8ClampedArray; width: number; height: number } {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  return {
    imgA: cropToRgba(a, width, height),
    imgB: cropToRgba(b, width, height),
    width,
    height,
  };
}

function cropToRgba(img: PNG, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (img.width * y + x) << 2;
      const dstIdx = (width * y + x) << 2;
      out[dstIdx] = img.data[srcIdx];
      out[dstIdx + 1] = img.data[srcIdx + 1];
      out[dstIdx + 2] = img.data[srcIdx + 2];
      out[dstIdx + 3] = img.data[srcIdx + 3];
    }
  }
  return out;
}

function paintDiff(diff: PNG, ssimMap: { data: Float64Array | Float32Array | number[]; width: number; height: number }, width: number, height: number): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const mapX = Math.min(ssimMap.width - 1, Math.floor((x / width) * ssimMap.width));
      const mapY = Math.min(ssimMap.height - 1, Math.floor((y / height) * ssimMap.height));
      const local = ssimMap.data[mapY * ssimMap.width + mapX];
      const idx = (width * y + x) << 2;
      // Rouge = fort écart (ssim local bas), blanc = identique.
      const intensity = Math.round(255 * Math.max(0, Math.min(1, local)));
      diff.data[idx] = 255;
      diff.data[idx + 1] = intensity;
      diff.data[idx + 2] = intensity;
      diff.data[idx + 3] = 255;
    }
  }
}
