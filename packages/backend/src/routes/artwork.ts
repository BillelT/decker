/**
 * Aperçus des cards de la landing — les six de "What Decker does" et les
 * trois de "How it works".
 *
 * Dessinés en SVG inline plutôt qu'en capture : ce sont des schémas, pas des
 * screenshots — ils restent nets à toutes les tailles, ne pèsent rien, et
 * suivent les tokens de couleur du site (`var(--b-*)`) au lieu de figer la
 * palette dans un bitmap. Même `viewBox` pour tous, calé sur le ratio 8/5 de
 * `.card__media`, pour que les rangées de cards restent régulières.
 *
 * Vocabulaire commun à tous les schémas : un cadre blanc bordé = une maquette
 * Figma ou une diapo Slides, une barre `accent-soft` = un titre, des barres
 * `gray-300` = du texte, un aplat `gray-100` = une image, l'orange = ce que
 * Decker fait ou ce que l'utilisateur a sélectionné.
 */

const VIEW_BOX = '0 0 320 200';

const svg = (label: string, body: string): string =>
  `<svg class="card__media" viewBox="${VIEW_BOX}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

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

/** How it works, étape 1 — le canvas Figma, deux maquettes sur quatre sélectionnées. */
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
 * How it works, étape 2 — maquette Figma à gauche, diapo Slides à droite. Les deux portent
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

/** How it works, étape 3 — le deck livré dans Google Slides : pellicule de diapos et diapo courante. */
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

/* ------------------------------------------------------------------ *
 * "What Decker does" — un aperçu par point fort.
 * ------------------------------------------------------------------ */

/** Flèche "Decker fait la transformation", commune aux schémas avant/après. */
const arrow = (x1: number, x2: number, y: number): string => `
  <g stroke="var(--b-accent)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" />
    <polyline points="${x2 - 6},${y - 6} ${x2},${y} ${x2 - 6},${y + 6}" />
  </g>`;

/** 100% free — un paywall barré : ni prix, ni moyen de paiement à saisir. */
export const FEATURE_FREE_SVG = svg(
  'A checkout paywall crossed out',
  `
  <rect x="74" y="34" width="172" height="132" fill="var(--b-surface)" stroke="var(--b-border)" />
  <rect x="74" y="34" width="172" height="22" fill="var(--b-gray-100)" />
  <line x1="74" y1="56" x2="246" y2="56" stroke="var(--b-border)" />
  <rect x="90" y="72" width="56" height="6" fill="var(--b-gray-300)" />
  <rect x="90" y="88" width="42" height="16" fill="var(--b-gray-300)" />
  <rect x="90" y="120" width="140" height="16" fill="var(--b-surface)" stroke="var(--b-border)" />
  <rect x="98" y="125" width="60" height="6" fill="var(--b-gray-300)" />
  <rect x="90" y="146" width="66" height="12" fill="var(--b-gray-300)" />
  <line x1="62" y1="178" x2="258" y2="22" stroke="var(--b-accent)" stroke-width="3" stroke-linecap="round" />`,
);

/** Export complet — six maquettes du fichier Figma deviennent un deck entier, pas une diapo. */
export const FEATURE_FULL_DECK_SVG = svg(
  'Six Figma frames turning into one full slide deck',
  `
  ${[0, 1, 2]
    .flatMap((row) => [0, 1].map((col) => [18 + col * 52, 44 + row * 40] as const))
    .map(
      ([x, y]) => `
  <rect x="${x}" y="${y}" width="44" height="32" fill="var(--b-surface)" stroke="var(--b-border)" />
  <rect x="${x + 6}" y="${y + 6}" width="20" height="4" fill="var(--b-accent-soft)" />
  <rect x="${x + 6}" y="${y + 16}" width="32" height="4" fill="var(--b-gray-300)" />
  <rect x="${x + 6}" y="${y + 24}" width="24" height="4" fill="var(--b-gray-300)" />`,
    )
    .join('')}
  ${arrow(130, 156, 100)}
  <rect x="180" y="70" width="118" height="80" fill="var(--b-gray-100)" stroke="var(--b-border)" />
  <rect x="174" y="62" width="118" height="80" fill="var(--b-surface)" stroke="var(--b-border)" />
  <rect x="168" y="54" width="118" height="80" fill="var(--b-surface)" stroke="var(--b-border)" />
  <rect x="180" y="66" width="60" height="10" fill="var(--b-accent-soft)" />
  <rect x="180" y="86" width="44" height="36" fill="var(--b-gray-100)" />
  <rect x="234" y="86" width="40" height="6" fill="var(--b-gray-300)" />
  <rect x="234" y="100" width="40" height="6" fill="var(--b-gray-300)" />
  <rect x="234" y="114" width="26" height="6" fill="var(--b-gray-300)" />`,
);

/** Export template — une maquette devient une mise en page réutilisable, thème compris. */
export const FEATURE_TEMPLATE_SVG = svg(
  'A single Figma frame turning into a reusable Slides layout with its theme colors',
  `
  <rect x="20" y="50" width="110" height="82" fill="var(--b-surface)" stroke="var(--b-border)" />
  <rect x="32" y="62" width="58" height="10" fill="var(--b-accent-soft)" />
  <rect x="32" y="82" width="40" height="38" fill="var(--b-gray-100)" />
  <rect x="80" y="82" width="38" height="6" fill="var(--b-gray-300)" />
  <rect x="80" y="96" width="38" height="6" fill="var(--b-gray-300)" />
  <rect x="80" y="110" width="24" height="6" fill="var(--b-gray-300)" />
  ${arrow(142, 168, 91)}
  <rect x="180" y="50" width="120" height="82" fill="var(--b-surface)" stroke="var(--b-border)" />
  <g fill="none" stroke="var(--b-accent)" stroke-width="1" stroke-dasharray="4 3">
    <rect x="192" y="62" width="96" height="16" />
    <rect x="192" y="86" width="44" height="34" />
    <rect x="244" y="86" width="44" height="34" />
  </g>
  <g>
    <rect x="180" y="146" width="18" height="18" fill="var(--b-accent)" />
    <rect x="204" y="146" width="18" height="18" fill="var(--b-accent-soft)" />
    <rect x="228" y="146" width="18" height="18" fill="var(--b-ink)" />
    <rect x="252" y="146" width="18" height="18" fill="var(--b-gray-300)" />
  </g>`,
);

/** Une ligne de la liste du plugin : case à cocher, vignette, nom de la maquette. */
const pickRow = (y: number, checked: boolean): string => `
  ${
    checked
      ? `<rect x="90" y="${y}" width="16" height="16" fill="var(--b-accent)" />
  <polyline points="93.5,${y + 8} 97,${y + 11.5} 102.5,${y + 4.5}" fill="none" stroke="var(--b-surface)"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`
      : `<rect x="90" y="${y}" width="16" height="16" fill="var(--b-surface)" stroke="var(--b-border)" />`
  }
  <rect x="116" y="${y + 1}" width="20" height="14" fill="var(--b-gray-100)" />
  <rect x="146" y="${y + 5}" width="80" height="6" fill="var(--b-gray-300)" />`;

/** Choix des maquettes — la liste du plugin, avec ses cases à cocher. */
export const FEATURE_PICK_SVG = svg(
  'The plugin panel listing frames, with some of them ticked',
  `
  <rect x="76" y="26" width="168" height="148" fill="var(--b-surface)" stroke="var(--b-border)" />
  <rect x="76" y="26" width="168" height="22" fill="var(--b-gray-100)" />
  <line x1="76" y1="48" x2="244" y2="48" stroke="var(--b-border)" />
  <rect x="88" y="34" width="52" height="6" fill="var(--b-gray-300)" />
  ${pickRow(62, true)}${pickRow(92, true)}${pickRow(122, false)}${pickRow(152, true)}`,
);

/** Objets natifs — la même diapo en capture aplatie à gauche, en objets éditables à droite. */
export const FEATURE_NATIVE_SVG = svg(
  'A flattened screenshot on the left, the same slide as editable objects on the right',
  `
  <rect x="20" y="50" width="110" height="82" fill="var(--b-gray-100)" stroke="var(--b-border)" />
  <g fill="none" stroke="var(--b-gray-300)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="56" cy="76" r="7" />
    <polyline points="34,116 62,90 84,110 98,98 116,116" />
  </g>
  ${arrow(142, 168, 91)}
  <rect x="180" y="50" width="120" height="82" fill="var(--b-surface)" stroke="var(--b-border)" />
  <rect x="194" y="64" width="64" height="12" fill="var(--b-accent-soft)" />
  <rect x="190" y="60" width="72" height="20" fill="none" stroke="var(--b-accent)" />
  ${handles(190, 60, 72, 20)}
  <rect x="194" y="90" width="44" height="30" fill="var(--b-gray-100)" />
  <rect x="248" y="90" width="40" height="6" fill="var(--b-gray-300)" />
  <rect x="248" y="102" width="40" height="6" fill="var(--b-gray-300)" />
  <rect x="248" y="114" width="26" height="6" fill="var(--b-gray-300)" />`,
);

/** Rien de gardé — le bouclier, et un stockage qui reste vide une fois l'export fini. */
export const FEATURE_PRIVATE_SVG = svg(
  'A shield above an empty storage box',
  `
  <path d="M160 26 L198 40 V80 C198 105 180 122 160 132 C140 122 122 105 122 80 V40 Z"
    fill="var(--b-accent-soft)" stroke="var(--b-accent)" stroke-width="2" stroke-linejoin="round" />
  <polyline points="144,78 155,90 178,62" fill="none" stroke="var(--b-ink)" stroke-width="3"
    stroke-linecap="round" stroke-linejoin="round" />
  <rect x="92" y="148" width="136" height="30" fill="none" stroke="var(--b-gray-300)" stroke-dasharray="5 4" />`,
);
