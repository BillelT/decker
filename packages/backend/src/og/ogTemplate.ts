/**
 * Gabarit HTML de l'image Open Graph (og:image) des pages publiques.
 *
 * Ce fichier n'est PAS servi tel quel : il n'existe que pour être rasterisé
 * en PNG 1200x630 par `src/og/render.ts` (Chromium/Playwright, script de
 * maintenance lancé à la main), dont la sortie est écrite en base64 dans
 * `src/og/ogImageData.ts` — le seul module lu à l'exécution. Les réseaux
 * sociaux ne rendent pas de SVG ni de HTML pour une carte de partage : il
 * leur faut un bitmap, d'où cette étape de rendu hors ligne plutôt qu'une
 * génération à la volée (qui demanderait un moteur de rendu dans la
 * fonction serverless).
 *
 * DA : hybride "Windows 95 + marque Billel", même parti pris que le skin du
 * plugin (packages/plugin/src/styles.hybrid.css) — chrome 95 (biseaux à
 * quatre ombres internes, barre de titre bleu marine, barre d'état) habillé
 * de la palette et de la typo de marque (orange #f06800, Cabinet Grotesk).
 *
 * Contraintes de la carte de partage, qui expliquent les valeurs ci-dessous :
 * - 1200x630 (ratio 1.91:1), la seule taille sûre sur Facebook/LinkedIn/X ;
 * - tout le contenu qui doit rester lisible tient dans la zone centrale
 *   1080x600 (marges de 60px), les bords pouvant être rognés selon la
 *   plateforme — seul le chrome décoratif de la fenêtre y déborde ;
 * - typo volumineuse (76px pour l'accroche, 27px pour la phrase dessous) : la
 *   carte est vue en vignette, tout ce qui passe sous ~24px n'y est plus
 *   qu'une texture — d'où le chrome 95, seul élément écrit plus petit, qui
 *   ne porte aucune information ;
 * - texte noir sur papier crème, contraste maximal, et peu de mots :
 *   une accroche, une phrase, une URL.
 */

import { CABINET_GROTESK_BASE64 } from '../routes/fontData.js';
import { DECKER_MARK_SVG } from '../routes/brand.js';
import type { OgImageContent } from './variants.js';

/** Flèche "→" dessinée en SVG blocky plutôt qu'en glyphe : Cabinet Grotesk
 *  n'a pas de flèche, un fallback système en poserait une d'une autre fonte
 *  au milieu du titre. En pixels francs, elle passe pour un élément 95. */
const PIXEL_ARROW = `<svg class="headline__arrow" viewBox="0 0 20 14" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="6" width="12" height="2" fill="currentColor"/>
  <rect x="12" y="0" width="2" height="14" fill="currentColor"/>
  <rect x="14" y="2" width="2" height="10" fill="currentColor"/>
  <rect x="16" y="4" width="2" height="6" fill="currentColor"/>
  <rect x="18" y="6" width="2" height="2" fill="currentColor"/>
</svg>`;

const CSS = `
@font-face {
  font-family: "Cabinet Grotesk";
  src: url("data:font/woff2;base64,${CABINET_GROTESK_BASE64}") format("woff2-variations");
  font-weight: 400 900;
  font-style: normal;
}

/* Palette système 95 + tokens de marque, repris tels quels de
   packages/plugin/src/styles.win95.css et routes/marketingStyles.ts. */
:root {
  --w95-face: #c0c0c0;
  --w95-shadow: #808080;
  --w95-dark: #0a0a0a;
  --w95-light: #dfdfdf;
  --w95-white: #ffffff;
  --w95-navy: #000080;
  --w95-navy-light: #1084d0;
  --w95-out: inset -2px -2px var(--w95-dark), inset 2px 2px var(--w95-white),
    inset -4px -4px var(--w95-shadow), inset 4px 4px var(--w95-light);
  --w95-in: inset -2px -2px var(--w95-white), inset 2px 2px var(--w95-shadow),
    inset -4px -4px var(--w95-light), inset 4px 4px var(--w95-dark);

  --b-ink: #120f0d;
  --b-paper: #fff9f5;
  --b-muted: #575757;
  --b-accent: #f06800;
  /* Police de chrome : MS Sans Serif/Tahoma n'existent pas sur la machine de
     rendu, Liberation Sans (métriques Arial) est le substitut le plus proche. */
  --chrome-font: "Liberation Sans", Tahoma, "MS Sans Serif", Arial, sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  width: 1200px;
  height: 630px;
  overflow: hidden;
  font-family: "Cabinet Grotesk", sans-serif;
  color: var(--b-ink);
  -webkit-font-smoothing: antialiased;
}

/* Bureau : aplat orange de marque tramé d'un damier 3px, clin d'oeil au
   dithering des fonds 256 couleurs. Motif régulier = quelques octets de
   plus en PNG, la carte reste très en dessous des 300 Ko visés. */
.desktop {
  width: 1200px;
  height: 630px;
  padding: 40px;
  background-color: var(--b-accent);
  background-image:
    conic-gradient(#dd6000 25%, transparent 0 50%, #dd6000 0 75%, transparent 0);
  background-size: 6px 6px;
}

.window {
  width: 100%;
  height: 100%;
  padding: 4px;
  display: flex;
  flex-direction: column;
  background: var(--w95-face);
  box-shadow: var(--w95-out);
}

.titlebar {
  height: 52px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 4px 0 8px;
  background: linear-gradient(90deg, var(--w95-navy) 0%, var(--w95-navy-light) 100%);
}
.titlebar__icon { width: 32px; height: 32px; flex: none; display: block; }
.titlebar__label {
  flex: 1;
  font-family: var(--chrome-font);
  font-size: 22px;
  font-weight: 700;
  color: #fff;
}
.titlebar__buttons { display: flex; gap: 4px; }
.titlebar__btn {
  width: 40px;
  height: 34px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 8px;
  background: var(--w95-face);
  box-shadow: var(--w95-out);
}
.titlebar__btn span { display: block; width: 16px; height: 3px; background: #000; }
.titlebar__btn--box span { height: 14px; border: 2px solid #000; border-top-width: 4px; background: none; }
.titlebar__btn--close { align-items: center; padding-bottom: 0; }
.titlebar__btn--close svg { width: 16px; height: 16px; display: block; }

/* Zone client creusée, "papier" crème : noir sur crème = le contraste le
   plus fort de la palette, ce qui tient en vignette. */
.client {
  flex: 1;
  margin-top: 4px;
  padding: 4px;
  background: var(--w95-face);
  box-shadow: var(--w95-in);
}
.paper {
  height: 100%;
  padding: 40px 56px;
  display: flex;
  align-items: center;
  gap: 40px;
  background: var(--b-paper);
}
.paper__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 22px;
}
/* La marque en grand plutôt qu'un aplat vide : elle équilibre la colonne de
   texte, et c'est le seul repère qui reste identifiable quand la carte est
   rognée au carré par une plateforme. */
.paper__mark { width: 208px; height: 208px; flex: none; display: block; }

.lockup { display: flex; align-items: center; gap: 14px; }
.lockup__name {
  font-size: 38px;
  font-weight: 700;
  letter-spacing: -0.03em;
}
.lockup__tag {
  margin-left: 4px;
  padding: 7px 14px 8px;
  background: var(--w95-face);
  box-shadow: var(--w95-out);
  font-family: var(--chrome-font);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.headline {
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: 76px;
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -0.035em;
  white-space: nowrap;
}
.headline__arrow { width: 60px; height: 42px; flex: none; color: var(--b-accent); }

.subline {
  max-width: 960px;
  font-size: 27px;
  font-weight: 500;
  line-height: 1.35;
  color: var(--b-muted);
}

/* Appel à l'action dessiné comme un bouton 95, mais à l'orange de marque :
   une carte de partage n'est pas cliquable, il sert à dire d'un coup d'oeil
   où va le lien — c'est aussi le seul élément de la carte qui ne soit pas
   du texte à lire. */
.cta {
  margin-top: 6px;
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 24px 18px;
  background: var(--b-accent);
  box-shadow: inset -2px -2px var(--w95-dark), inset 2px 2px rgba(255, 255, 255, 0.75),
    inset -4px -4px rgba(18, 15, 13, 0.35), inset 4px 4px rgba(255, 255, 255, 0.35);
  font-size: 25px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--b-ink);
}
.cta__arrow { width: 26px; height: 18px; display: block; color: var(--b-ink); }

.statusbar {
  height: 42px;
  flex: none;
  margin-top: 4px;
  display: flex;
  gap: 4px;
  font-family: var(--chrome-font);
  font-size: 18px;
}
.statusbar__field {
  display: flex;
  align-items: center;
  padding: 0 12px;
  box-shadow: inset -1px -1px var(--w95-white), inset 1px 1px var(--w95-shadow);
}
.statusbar__field--url { flex: 1; font-weight: 700; }
`;

/** HTML autonome (police et images incluses) prêt à être rasterisé. */
export function renderOgImageHtml(content: OgImageContent): string {
  const markInline = DECKER_MARK_SVG.replace(/^<svg/, '<svg class="paper__mark"');
  const iconInline = DECKER_MARK_SVG.replace(/^<svg/, '<svg class="titlebar__icon"');
  const [before, after] = content.headline.split('->');
  const headline =
    after === undefined
      ? `<span>${before}</span>`
      : `<span>${before.trim()}</span>${PIXEL_ARROW}<span>${after.trim()}</span>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${CSS}</style>
</head>
<body>
<div class="desktop">
  <div class="window">
    <div class="titlebar">
      ${iconInline}
      <span class="titlebar__label">${content.windowTitle}</span>
      <span class="titlebar__buttons">
        <span class="titlebar__btn"><span></span></span>
        <span class="titlebar__btn titlebar__btn--box"><span></span></span>
        <span class="titlebar__btn titlebar__btn--close">
          <svg viewBox="0 0 16 16" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 2h3v2h2v2h2V4h2V2h3v3h-2v2h-2v2h2v2h2v3h-3v-2h-2v-2H7v2H5v2H2v-3h2V9h2V7H4V5H2z" fill="#000"/>
          </svg>
        </span>
      </span>
    </div>
    <div class="client">
      <div class="paper">
        <div class="paper__text">
        <div class="lockup">
          <span class="lockup__name">Decker</span>
          <span class="lockup__tag">Figma plugin</span>
        </div>
        <h1 class="headline">${headline}</h1>
        <p class="subline">${content.subline}</p>
        <span class="cta">${content.cta}${PIXEL_ARROW.replace('headline__arrow', 'cta__arrow')}</span>
        </div>
        ${markInline}
      </div>
    </div>
    <div class="statusbar">
      <span class="statusbar__field statusbar__field--url">decker.billeltighidet.fr</span>
      <span class="statusbar__field">Free &amp; open</span>
    </div>
  </div>
</div>
</body>
</html>`;
}
