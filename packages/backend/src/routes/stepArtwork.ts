/**
 * Aperçus des trois étapes de "How it works" (section de la landing).
 *
 * Dessinés en SVG inline plutôt qu'en capture : ce sont des schémas, pas des
 * screenshots — ils restent nets à toutes les tailles, ne pèsent rien, et
 * suivent les tokens de couleur du site (`var(--b-*)`) au lieu de figer la
 * palette dans un bitmap. Même `viewBox` pour les trois, calé sur le ratio
 * 8/5 de `.steps__media`, pour que la rangée de cards reste régulière.
 */

const VIEW_BOX = '0 0 320 200';

const svg = (label: string, body: string): string =>
  `<svg class="steps__media" viewBox="${VIEW_BOX}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

/** Contenu factice d'une maquette : vignette + trois lignes de texte. */
const frameContent = (x: number, y: number, accent: boolean): string => `
  <rect x="${x + 10}" y="${y + 10}" width="36" height="42" fill="${accent ? 'var(--b-accent-soft)' : 'var(--b-gray-100)'}" />
  <rect x="${x + 54}" y="${y + 12}" width="52" height="5" fill="var(--b-gray-300)" />
  <rect x="${x + 54}" y="${y + 24}" width="38" height="5" fill="var(--b-gray-300)" />
  <rect x="${x + 54}" y="${y + 36}" width="46" height="5" fill="var(--b-gray-300)" />`;

/** Poignées de sélection Figma aux quatre coins d'une maquette. */
const handles = (x: number, y: number, w: number, h: number): string =>
  [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ]
    .map(
      ([hx, hy]) =>
        `<rect x="${hx - 2.5}" y="${hy - 2.5}" width="5" height="5" fill="var(--b-surface)" stroke="var(--b-accent)" stroke-width="1.5" />`,
    )
    .join('');

/** Une maquette du canvas Figma : libellé, cadre, contenu, sélection éventuelle. */
const frame = (x: number, y: number, selected: boolean): string => {
  const w = 118;
  const h = 62;
  return `
  <rect x="${x}" y="${y - 11}" width="34" height="5" fill="var(--b-gray-300)" />
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--b-surface)"
    stroke="${selected ? 'var(--b-accent)' : 'var(--b-border)'}" stroke-width="${selected ? 1.5 : 1}" />
  ${frameContent(x, y, selected)}
  ${selected ? handles(x, y, w, h) : ''}`;
};

/** Étape 1 — le canvas Figma, deux maquettes sur quatre sélectionnées. */
export const STEP_PICK_FRAMES_SVG = svg(
  'Four frames on a Figma canvas, two of them selected',
  `${frame(28, 38, true)}${frame(174, 38, false)}${frame(28, 116, false)}${frame(174, 116, true)}`,
);

/** Contenu d'une diapo, identique des deux côtés de l'étape 2 : c'est ce qui porte le "pixel for pixel". */
const slideContent = (x: number, y: number): string => `
  <rect x="${x + 12}" y="${y + 14}" width="64" height="8" fill="var(--b-accent-soft)" />
  <rect x="${x + 12}" y="${y + 34}" width="42" height="40" fill="var(--b-gray-100)" />
  <rect x="${x + 62}" y="${y + 34}" width="44" height="6" fill="var(--b-gray-300)" />
  <rect x="${x + 62}" y="${y + 48}" width="44" height="6" fill="var(--b-gray-300)" />
  <rect x="${x + 62}" y="${y + 62}" width="30" height="6" fill="var(--b-gray-300)" />`;

/**
 * Étape 2 — maquette Figma à gauche, diapo Slides à droite. Les deux portent
 * exactement les mêmes blocs, et les repères pointillés sont tracés par-dessus
 * les cadres (et non derrière, où ils se réduisaient à deux traits flottants
 * dans le vide) pour qu'on voie qu'ils traversent les deux : c'est ce qui rend
 * lisible le "pixel for pixel".
 */
export const STEP_MATCHED_SVG = svg(
  'A Figma frame and a Google Slides slide side by side, their blocks aligned on the same guides',
  `
  <rect x="20" y="52" width="118" height="96" fill="var(--b-surface)" stroke="var(--b-border)" />
  ${slideContent(20, 52)}
  <rect x="182" y="52" width="118" height="96" fill="var(--b-surface)" stroke="var(--b-border)" />
  ${slideContent(182, 52)}
  <g stroke="var(--b-accent)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <line x1="146" y1="100" x2="172" y2="100" />
    <polyline points="166,94 172,100 166,106" />
  </g>
  <g stroke="var(--b-accent)" stroke-width="1" stroke-dasharray="3 3" opacity=".45">
    <line x1="14" y1="66" x2="306" y2="66" />
    <line x1="14" y1="126" x2="306" y2="126" />
  </g>`,
);

/** Étape 3 — le deck livré dans Google Slides : pellicule de diapos et diapo courante. */
export const STEP_GET_DECK_SVG = svg(
  'A finished deck open in Google Slides, with its slide filmstrip',
  `
  <rect x="20" y="28" width="280" height="144" fill="var(--b-surface)" stroke="var(--b-border)" />
  <rect x="20" y="28" width="280" height="20" fill="var(--b-gray-100)" />
  <line x1="20" y1="48" x2="300" y2="48" stroke="var(--b-border)" />
  <g fill="var(--b-gray-300)">
    <circle cx="32" cy="38" r="2.5" /><circle cx="42" cy="38" r="2.5" /><circle cx="52" cy="38" r="2.5" />
  </g>
  <rect x="30" y="58" width="52" height="30" fill="var(--b-surface)" stroke="var(--b-accent)" stroke-width="1.5" />
  <rect x="36" y="64" width="24" height="4" fill="var(--b-accent-soft)" />
  <rect x="36" y="73" width="40" height="4" fill="var(--b-gray-300)" />
  <rect x="30" y="96" width="52" height="30" fill="var(--b-surface)" stroke="var(--b-border)" />
  <rect x="36" y="102" width="24" height="4" fill="var(--b-gray-300)" />
  <rect x="36" y="111" width="40" height="4" fill="var(--b-gray-300)" />
  <rect x="30" y="134" width="52" height="30" fill="var(--b-surface)" stroke="var(--b-border)" />
  <rect x="36" y="140" width="24" height="4" fill="var(--b-gray-300)" />
  <rect x="36" y="149" width="40" height="4" fill="var(--b-gray-300)" />
  <rect x="94" y="58" width="190" height="106" fill="var(--b-surface)" stroke="var(--b-border)" />
  <rect x="106" y="70" width="104" height="10" fill="var(--b-accent-soft)" />
  <rect x="106" y="92" width="76" height="58" fill="var(--b-gray-100)" />
  <rect x="194" y="92" width="78" height="6" fill="var(--b-gray-300)" />
  <rect x="194" y="106" width="78" height="6" fill="var(--b-gray-300)" />
  <rect x="194" y="120" width="52" height="6" fill="var(--b-gray-300)" />`,
);
