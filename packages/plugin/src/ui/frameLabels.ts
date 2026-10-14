/**
 * Libellés dérivés d'une frame, pour le rail et l'aperçu du mode deck.
 */

/**
 * Préfixes posés par "Prepare for Slides" sur les copies qu'il crée (voir
 * `SLIDES_READY_PREFIX` / `TEMPLATE_READY_PREFIX` dans code.ts). Identiques
 * sur toutes les copies, ils n'aident pas à reconnaître une frame et
 * mangeraient la moitié des 150 px de nom du rail.
 */
const READY_PREFIXES = ['[Slides Ready] ', '[Template Ready] '];

/** Nom de la frame tel qu'affiché dans le rail : sans le préfixe de copie. Le nom Figma complet reste dans l'infobulle. */
export function displayFrameName(name: string): string {
  for (const prefix of READY_PREFIXES) {
    if (name.startsWith(prefix)) return name.slice(prefix.length);
  }
  return name;
}

/**
 * Ratios courants, nommés comme dans les réglages de Google Slides et les
 * presets de frame Figma. Une frame de 1366 × 768 (1.7786) se lit "16:9",
 * pas "683:384".
 */
const COMMON_RATIOS: [number, number][] = [
  [16, 9],
  [16, 10],
  [4, 3],
  [3, 2],
  [1, 1],
  [21, 9],
  [5, 4],
  [9, 16],
  [10, 16],
  [3, 4],
  [2, 3],
  [4, 5],
];

/** Même tolérance que le filtre de ratio de code.ts (`RATIO_TOLERANCE`). */
const RATIO_TOLERANCE = 0.01;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * "16:9", "4:3", "1:1"… ou, pour un format hors de la liste, la fraction
 * réduite si elle reste lisible ("7:5"), sinon une valeur décimale
 * ("1.41:1").
 */
export function aspectRatioLabel(width: number, height: number): string {
  if (!(width > 0) || !(height > 0)) return '';
  const ratio = width / height;
  for (const [w, h] of COMMON_RATIOS) {
    if (Math.abs(ratio - w / h) / (w / h) <= RATIO_TOLERANCE) return `${w}:${h}`;
  }
  const rw = Math.round(width);
  const rh = Math.round(height);
  const divisor = gcd(rw, rh);
  if (rw / divisor <= 32 && rh / divisor <= 32) return `${rw / divisor}:${rh / divisor}`;
  return `${(Math.round(ratio * 100) / 100).toString()}:1`;
}

/** Légende de l'aperçu : "1920 × 1080 px · 16:9". */
export function frameSizeCaption(width: number, height: number): string {
  const size = `${Math.round(width)} × ${Math.round(height)} px`;
  const ratio = aspectRatioLabel(width, height);
  return ratio ? `${size} · ${ratio}` : size;
}

const englishPlural = new Intl.PluralRules('en');

/** "1 slide", "3 slides" : nombre et nom accordé, en une seule chaîne. */
export function countLabel(count: number, one: string, other = `${one}s`): string {
  return `${count} ${englishPlural.select(count) === 'one' ? one : other}`;
}
