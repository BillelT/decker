import { writeFile } from 'node:fs/promises';

export interface BboxDeviation {
  objectId: string;
  expectedXPt: number;
  expectedYPt: number;
  actualXPt: number;
  actualYPt: number;
  deviationPt: number;
}

export interface FixtureResult {
  name: string;
  ssimScore: number;
  referencePng: Buffer;
  renderedPng: Buffer;
  diffPng: Buffer;
  bboxDeviations: BboxDeviation[];
  ssimThreshold: number;
  bboxThresholdPt: number;
}

/** Spec §4.5 — calibration-report.html : 3 images côte à côte + tableau des écarts. */
export async function writeCalibrationReport(outPath: string, results: FixtureResult[]): Promise<void> {
  const sections = results.map(renderFixtureSection).join('\n');
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Rapport de calibration — figma-to-slides</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; background: #0b0b0f; color: #e6e6e6; }
  h1 { font-size: 1.4rem; }
  section { margin-bottom: 3rem; border-bottom: 1px solid #333; padding-bottom: 2rem; }
  .images { display: flex; gap: 1rem; flex-wrap: wrap; }
  .images figure { margin: 0; }
  .images img { max-width: 320px; border: 1px solid #444; }
  figcaption { font-size: 0.8rem; opacity: 0.8; text-align: center; }
  table { border-collapse: collapse; margin-top: 1rem; font-size: 0.85rem; }
  th, td { border: 1px solid #333; padding: 4px 8px; text-align: right; }
  th { text-align: center; }
  .pass { color: #7CFC9A; }
  .fail { color: #FF6B6B; }
</style>
</head>
<body>
<h1>Rapport de calibration — figma-to-slides (spec §4)</h1>
<p>Généré le ${new Date().toISOString()}</p>
${sections}
</body>
</html>`;
  await writeFile(outPath, html, 'utf8');
}

function renderFixtureSection(r: FixtureResult): string {
  const ssimPass = r.ssimScore >= r.ssimThreshold;
  const rows = r.bboxDeviations
    .map(
      (d) => `<tr class="${d.deviationPt <= r.bboxThresholdPt ? 'pass' : 'fail'}">
        <td>${d.objectId}</td>
        <td>${d.expectedXPt.toFixed(3)}</td>
        <td>${d.expectedYPt.toFixed(3)}</td>
        <td>${d.actualXPt.toFixed(3)}</td>
        <td>${d.actualYPt.toFixed(3)}</td>
        <td>${d.deviationPt.toFixed(3)}</td>
      </tr>`,
    )
    .join('\n');

  return `<section>
  <h2>${r.name}</h2>
  <p>SSIM global : <span class="${ssimPass ? 'pass' : 'fail'}">${r.ssimScore.toFixed(4)}</span> (seuil ≥ ${r.ssimThreshold})</p>
  <div class="images">
    <figure><img src="data:image/png;base64,${r.referencePng.toString('base64')}" /><figcaption>Référence</figcaption></figure>
    <figure><img src="data:image/png;base64,${r.renderedPng.toString('base64')}" /><figcaption>Rendu Slides</figcaption></figure>
    <figure><img src="data:image/png;base64,${r.diffPng.toString('base64')}" /><figcaption>Diff (rouge = écart)</figcaption></figure>
  </div>
  <table>
    <thead><tr><th>objectId</th><th>x attendu (pt)</th><th>y attendu (pt)</th><th>x réel (pt)</th><th>y réel (pt)</th><th>écart (pt)</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
}
