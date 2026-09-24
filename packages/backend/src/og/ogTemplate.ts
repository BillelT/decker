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
 * internes (--hyb-out/--hyb-in) et angles droits.
 *
 * Mise en page en pile plutôt qu'en deux colonnes : logo en haut à gauche
 * (repère de page, pas un élément centré avec le reste), accroche pleine
 * largeur juste en dessous, aperçu du produit pleine largeur sous
 * l'accroche, sur le fond crème --b-white. Chaque bloc reprend toute la
 * largeur utile de la carte au lieu de se partager la page avec un autre :
 * la carte EST un extrait de la page, pas une simulation de logiciel. Pas
 * de nom de produit écrit en toutes lettres : le logo (icône seule) fait
 * déjà cette identification, un "Decker" en gros n'aurait fait que répéter
 * l'information sans rien ajouter à la vignette.
 *
 * Contraintes de la carte de partage, qui expliquent les valeurs ci-dessous :
 * - 1200x630 (ratio 1.91:1), la seule taille sûre sur Facebook/LinkedIn/X ;
 * - tout le contenu qui doit rester lisible tient dans une zone centrale à
 *   48px des quatre bords, ceux-ci pouvant être rognés selon la plateforme ;
 * - typo volumineuse pour l'accroche : la carte est vue en vignette, tout ce
 *   qui passe sous ~24px n'y est plus qu'une texture ;
 * - encre sur crème, contraste maximal ;
 * - peu d'éléments dans la zone de contenu : un logo, une accroche, un
 *   aperçu du produit. Une carte de partage est lue en une seconde et n'est
 *   pas cliquable élément par élément, tout ce qui s'y ajoute au-delà ne
 *   fait que diluer l'accroche ;
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
  flex-direction: column;
  padding: 48px;
}

/* Logo seul (icône de marque), à la même marge du bord haut que le
   padding latéral : un repère de page en haut à gauche, pas un élément
   centré avec le reste du contenu. */
.logo__mark { width: 96px; height: 96px; flex: none; display: block; }

/* Pleine largeur sous le logo plutôt que dans une colonne partagée avec
   l'aperçu : une seule ligne d'accroche large se lit plus vite en vignette
   qu'un bloc de texte étroit sur plusieurs lignes. */
.headline {
  margin: 28px 0 0;
  font-size: 58px;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: var(--b-ink);
  text-wrap: balance;
}

/* Aperçu du produit plutôt que la marque en grand : montrer un moment du
   flow (le panneau du plugin, déjà dans son skin Modern) parle plus qu'une
   icône statique. Pleine largeur sous l'accroche, occupe toute la hauteur
   restante (object-fit: cover, la capture étant plus étroite que la bande
   large qui en résulte). Puits en creux (--hyb-in), comme .card__media du
   site et .f2s-frame-preview du plugin lui-même : une image n'y porte
   jamais de bordure, seul l'enfoncement la distingue du crème qui
   l'entoure. */
.preview {
  flex: 1;
  min-height: 0;
  margin-top: 28px;
  padding: 10px;
  background: var(--b-surface);
  box-shadow: var(--hyb-in);
}
.preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* Ancré en haut : la barre d'outils (bouton Export orange) et l'aperçu du
     canvas restent entiers, seul le bas du panneau (réglages, bouton café,
     moins parlant en vignette) est rogné par le recadrage. */
  object-position: top;
}
`;

/** HTML autonome (police et images incluses) prêt à être rasterisé. */
export function renderOgImageHtml(content: OgImageContent): string {
  const markInline = DECKER_MARK_SVG.replace(/^<svg/, '<svg class="logo__mark"');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${CSS}</style>
</head>
<body>
<div class="layout">
  ${markInline}
  <h1 class="headline">${content.headline}</h1>
  <div class="preview">
    <img src="data:image/png;base64,${TOOL_PREVIEW_PNG_BASE64}" alt="" />
  </div>
</div>
</body>
</html>`;
}
