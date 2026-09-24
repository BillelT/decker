/**
 * Gabarit HTML de l'image Open Graph (og:image) des pages publiques.
 *
 * Ce fichier n'est PAS servi tel quel : il n'existe que pour être rasterisé
 * en PNG 1200x630 par `src/og/render.ts` (Chromium/Playwright, script de
 * maintenance lancé à la main), dont la sortie est écrite en base64 dans
 * `src/og/ogImageData.ts`, le seul module lu à l'exécution. Les réseaux
 * sociaux ne rendent pas de SVG ni de HTML pour une carte de partage : il
 * leur faut un bitmap, d'où cette étape de rendu hors ligne plutôt qu'une
 * génération à la volée (qui demanderait un moteur de rendu dans la
 * fonction serverless).
 *
 * DA : skin "Modern" du produit (mêmes tokens que
 * packages/backend/src/routes/marketingStyles.ts et
 * packages/plugin/src/styles.modern.css) : palette de marque crème/encre,
 * accent orange #f06800, Cabinet Grotesk, biseaux hybrides à quatre ombres
 * internes (--hyb-out/--hyb-in, teintés depuis le texte plutôt que sur un
 * gris système fixe) et angles droits. Remplace l'ancienne DA "fenêtre
 * Windows 95" (chrome gris système, barre de titre bleu marine, police
 * W95FA) : ce chrome-là appartenait au skin `win95` du plugin, qui n'est
 * plus le skin par défaut depuis que `win95` a cédé sa place à `modern`
 * (ex-"hybrid") : la carte de partage doit refléter ce que voit vraiment un
 * nouvel utilisateur, pas un habillage alternatif optionnel.
 *
 * Mise en page reprise de la page d'accueil elle-même (.hero de
 * marketingStyles.ts) plutôt que d'une fenêtre d'app : colonne de texte à
 * gauche (badge, marque, accroche), aperçu du produit à droite dans un puits
 * en creux (--hyb-in), sur le fond crème --b-white du site : la carte EST un
 * extrait de la page, pas une simulation de logiciel.
 *
 * Contraintes de la carte de partage, qui expliquent les valeurs ci-dessous :
 * - 1200x630 (ratio 1.91:1), la seule taille sûre sur Facebook/LinkedIn/X ;
 * - tout le contenu qui doit rester lisible tient dans une zone centrale à
 *   60px des quatre bords, ceux-ci pouvant être rognés selon la plateforme ;
 * - typo volumineuse (128px pour la marque) : la carte est vue en vignette,
 *   tout ce qui passe sous ~24px n'y est plus qu'une texture ;
 * - encre sur crème, contraste maximal ;
 * - peu d'éléments dans la zone de contenu : un badge "type de produit", la
 *   marque, la phrase qui la précise, un aperçu du produit. Une carte de
 *   partage est lue en une seconde et n'est pas cliquable élément par
 *   élément, tout ce qui s'y ajoute au-delà ne fait que diluer l'accroche ;
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

/* Palette et biseaux hybrides, repris tels quels de
   packages/backend/src/routes/marketingStyles.ts (:root) et
   packages/plugin/src/styles.modern.css (--hyb-*), valeurs "clair" : cette
   carte statique ne suit pas le thème sombre de Figma, pas plus que les
   pages HTML rendues côté serveur (auth.ts). */
:root {
  --b-ink: #120f0d;
  --b-white: #fff9f5;
  --b-surface: #ffffff;
  --b-muted: #3b3735;
  --b-accent: #f06800;

  --hyb-hi: rgba(255, 255, 255, 0.9);
  --hyb-lo: rgba(18, 15, 13, 0.22);
  --hyb-lo-strong: rgba(18, 15, 13, 0.4);
  --hyb-out: inset -1px -1px var(--hyb-lo), inset 1px 1px var(--hyb-hi), inset -2px -2px var(--hyb-lo-strong),
    inset 2px 2px var(--hyb-hi);
  --hyb-in: inset -1px -1px var(--hyb-hi), inset 1px 1px var(--hyb-lo), inset -2px -2px var(--hyb-hi),
    inset 2px 2px var(--hyb-lo-strong);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  width: 1200px;
  height: 630px;
  overflow: hidden;
  font-family: "Cabinet Grotesk", sans-serif;
  color: var(--b-ink);
  background: var(--b-white);
  -webkit-font-smoothing: antialiased;
}

.layout {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 64px;
  padding: 64px;
}

.text {
  flex: 1 1 420px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* Badge "type de produit", mêmes biseaux que les boutons du site (.cta,
   .tertiary de marketingStyles.ts), coins droits. */
.eyebrow {
  align-self: flex-start;
  padding: 10px 20px;
  background: var(--b-white);
  box-shadow: var(--hyb-out);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--b-muted);
}

/* Marque : icône + nom accolés, comme .header__brand du site, c'est la
   même paire qu'un visiteur voit déjà en haut de la page d'accueil. */
.brand {
  display: flex;
  align-items: center;
  gap: 20px;
}
.brand__mark { width: 84px; height: 84px; flex: none; display: block; }
.brand__name {
  font-size: 128px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
}

.subline {
  max-width: 480px;
  font-size: 27px;
  font-weight: 500;
  line-height: 1.45;
  letter-spacing: -0.002em;
  color: var(--b-muted);
}

/* Domaine, en repère discret sous l'accroche : la plateforme affiche déjà
   ce domaine sous la carte, celui-ci n'est là que comme signature de page. */
.domain {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 19px;
  font-weight: 600;
  color: var(--b-muted);
}
.domain::before {
  content: "";
  width: 8px;
  height: 8px;
  flex: none;
  background: var(--b-accent);
}

/* Aperçu du produit plutôt que la marque en grand : montrer un moment du
   flow (le panneau du plugin, déjà dans son skin Modern) parle plus qu'une
   icône statique. Puits en creux (--hyb-in), comme .card__media du site et
   .f2s-frame-preview du plugin lui-même : une image n'y porte jamais de
   bordure, seul l'enfoncement la distingue du crème qui l'entoure. */
.preview {
  flex: 0 0 512px;
  padding: 10px;
  background: var(--b-surface);
  box-shadow: var(--hyb-in);
}
.preview img { display: block; width: 100%; height: auto; }
`;

/** HTML autonome (police et images incluses) prêt à être rasterisé. */
export function renderOgImageHtml(content: OgImageContent): string {
  const markInline = DECKER_MARK_SVG.replace(/^<svg/, '<svg class="brand__mark"');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${CSS}</style>
</head>
<body>
<div class="layout">
  <div class="text">
    <span class="eyebrow">${content.eyebrow}</span>
    <div class="brand">
      ${markInline}
      <span class="brand__name">${content.headline}</span>
    </div>
    <p class="subline">${content.subline}</p>
    <span class="domain">${content.domain}</span>
  </div>
  <div class="preview">
    <img src="data:image/png;base64,${TOOL_PREVIEW_PNG_BASE64}" width="592" height="391" alt="" />
  </div>
</div>
</body>
</html>`;
}
