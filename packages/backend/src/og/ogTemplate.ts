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
 * La fenêtre est à fond perdu, ses biseaux collés aux quatre bords : une
 * fenêtre posée sur un bureau coloré aurait demandé de justifier ce bureau
 * (il n'existe nulle part ailleurs dans le produit) et aurait rétréci
 * d'autant la surface utile de la carte. À fond perdu, la carte EST la
 * fenêtre.
 *
 * Contraintes de la carte de partage, qui expliquent les valeurs ci-dessous :
 * - 1200x630 (ratio 1.91:1), la seule taille sûre sur Facebook/LinkedIn/X ;
 * - tout le contenu qui doit rester lisible tient dans la zone centrale
 *   1080x600 (marges de 60px), les bords pouvant être rognés selon la
 *   plateforme — seul le chrome de la fenêtre y déborde, et il ne porte
 *   aucune information ;
 * - typo volumineuse (92px pour l'accroche, 31px pour la phrase dessous) :
 *   la carte est vue en vignette, tout ce qui passe sous ~24px n'y est plus
 *   qu'une texture ;
 * - texte noir sur papier crème, contraste maximal ;
 * - peu d'éléments dans la zone de contenu : un badge "type de produit", le
 *   nom du produit, la phrase qui le précise, un aperçu du produit. Une
 *   carte de partage est lue en une seconde et n'est pas cliquable élément
 *   par élément — tout ce qui s'y ajoute au-delà ne fait que diluer l'accroche ;
 * - une seule carte pour tout le site (voir variants.ts) : les pages
 *   légales (privacy, terms) n'ont pas de propos propre à raconter en
 *   vignette, les distinguer n'aurait décrit que leur titre, pas le produit.
 */

import { CABINET_GROTESK_BASE64 } from '../routes/fontData.js';
import { DECKER_MARK_SVG } from '../routes/brand.js';
import { TOOL_PREVIEW_PNG_BASE64 } from './toolPreviewData.js';
import type { OgImageContent } from './variants.js';

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

.window {
  width: 1200px;
  height: 630px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  background: var(--w95-face);
  box-shadow: var(--w95-out);
}

.titlebar {
  height: 56px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 4px 0 10px;
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
  padding: 48px 56px;
  display: flex;
  align-items: center;
  gap: 48px;
  background: var(--b-paper);
}
.paper__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Badge "type de produit" façon tag 95 : mêmes biseaux que les boutons de la
   barre de titre, coins droits — Windows 95 n'a pas de coin arrondi, une
   pilule y aurait détonné. Fond au gris système --w95-face, le même que la
   barre d'état tout en bas de la carte : un blanc pur ou un bleu marine
   auraient introduit une teinte que rien d'autre sur la carte ne porte.
   Ce qui manquait à la lisibilité n'était pas le contraste texte/fond (déjà
   ~9:1, noir sur ce gris) mais la taille — 19px et un padding généreux
   au lieu des 17px du premier essai. */
.eyebrow {
  align-self: flex-start;
  padding: 10px 20px 11px;
  background: var(--w95-face);
  box-shadow: var(--w95-out);
  font-family: var(--chrome-font);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #000;
}
/* Aperçu du produit plutôt que la marque en grand : montrer un moment du
   flow (le panneau du plugin en train de préparer un export) parle plus
   qu'une icône statique, et équilibre la colonne de texte comme le faisait
   la marque avant elle. Recadrée serrée sur la fenêtre du plugin (pas de
   marge grise du canvas Figma), d'où le ratio proche de 2:1 plutôt que
   carré. Biseaux --w95-out repris du reste du chrome pour que l'aperçu se
   lise comme un élément posé sur le bureau, pas une image collée. */
.paper__preview {
  width: 480px;
  flex: none;
  padding: 6px;
  background: var(--w95-face);
  box-shadow: var(--w95-out);
}
.paper__preview img { display: block; width: 100%; height: auto; }

/* Essai : accroche composée dans la police de chrome système (le même
   empilement Tahoma/MS Sans Serif que la barre de titre) plutôt que Cabinet
   Grotesk, pour comparer le rendu "vraie fenêtre 95" au wordmark de marque
   habituel. */
.headline {
  font-family: var(--chrome-font);
  font-size: 92px;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.01em;
}

.subline {
  max-width: 560px;
  font-size: 31px;
  font-weight: 500;
  line-height: 1.5;
  letter-spacing: 0.003em;
  color: var(--b-muted);
}

/* Barre d'état réduite au domaine : la plateforme affiche déjà le nom de
   domaine sous la carte, celui-ci n'est là que comme élément de chrome. */
.statusbar {
  height: 44px;
  flex: none;
  margin-top: 4px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  box-shadow: inset -1px -1px var(--w95-white), inset 1px 1px var(--w95-shadow);
  font-family: var(--chrome-font);
  font-size: 18px;
  font-weight: 700;
}
`;

/** HTML autonome (police et images incluses) prêt à être rasterisé. */
export function renderOgImageHtml(content: OgImageContent): string {
  const iconInline = DECKER_MARK_SVG.replace(/^<svg/, '<svg class="titlebar__icon"');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${CSS}</style>
</head>
<body>
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
        <span class="eyebrow">${content.eyebrow}</span>
        <h1 class="headline">${content.headline}</h1>
        <p class="subline">${content.subline}</p>
      </div>
      <div class="paper__preview">
        <img src="data:image/png;base64,${TOOL_PREVIEW_PNG_BASE64}" width="480" height="246" alt="" />
      </div>
    </div>
  </div>
  <div class="statusbar">decker.billeltighidet.fr</div>
</div>
</body>
</html>`;
}
