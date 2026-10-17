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
 * DA : celle du site (routes/marketingStyles.ts), mêmes tokens --b-*, même
 * fond --b-surface, Cabinet Grotesk.
 *
 * Mise en page en pile : logo complet (icône + nom, le lockup du header, un
 * peu plus grand) en haut à gauche, le h1 du hero juste en dessous, puis la
 * fenêtre du plugin, tous trois dans la même marge latérale de page (48px).
 * Seul le bas de la fenêtre déborde volontairement de cette marge, jusqu'au
 * bord de la carte, comme une photo qui dépasse du cadre.
 *
 * La fenêtre du plugin n'est PAS recopiée ici : c'est celle de la démo du
 * hero (routes/heroDemo.ts), même markup, même CSS (celui du plugin,
 * régénéré par scripts/sync-plugin-styles.mjs), même script. render.ts
 * émule `prefers-reduced-motion: reduce`, la démo s'ouvre donc directement
 * dans son état figé (trois frames dans le rail, la couverture active), sans
 * curseur. Seuls la barre d'onglets et le canvas Figma autour sont masqués :
 * la carte montre le plugin, pas Figma. Une évolution de l'UI du plugin se
 * retrouve ainsi dans la carte au prochain `og:build`, sans rien recopier.
 *
 * Le crème du fond et le blanc cassé du plugin sont presque les mêmes : posée
 * telle quelle, la fenêtre se fondait dans la carte. Deux traitements pour
 * l'en détacher (`OgVariant`) :
 * - `shadow` : ombre portée dure à l'encre, décalée en bas à droite, celle
 *   des boutons du site et du chrome 95 du plugin ;
 * - `shape` : une forme orange (--b-accent) de la même géométrie que la
 *   fenêtre, derrière elle, qui vient de l'extérieur de la carte (collée aux
 *   bords droit et bas) et s'arrête avant le bord gauche de la fenêtre.
 *
 * Contraintes de la carte de partage, qui expliquent les valeurs ci-dessous :
 * - 1200x630 (ratio 1.91:1), la seule taille sûre sur Facebook/LinkedIn/X ;
 * - typo volumineuse pour le h1 : la carte est vue en vignette, tout ce qui
 *   passe sous ~24px n'y est plus qu'une texture ;
 * - peu d'éléments : un logo, un titre, le produit. Une carte de partage est
 *   lue en une seconde, tout ce qui s'y ajoute ne fait que diluer le titre ;
 * - une seule carte pour tout le site (voir variants.ts).
 */
import { DESIGN_TOKENS_CSS } from '../generated/designTokens.js';
import { CABINET_GROTESK_BASE64 } from '../routes/fontData.js';
import { DECKER_MARK_SVG } from '../routes/brand.js';
import { HERO_DEMO_CSS, HERO_DEMO_HTML, HERO_DEMO_JS } from '../routes/heroDemo.js';
import type { OgImageContent, OgVariant } from './variants.js';

/** Largeur de la fenêtre du plugin dans la démo (heroDemo.ts, .dm-pwin). */
const PWIN_WIDTH = 960;
/** Largeur utile de la carte : 1200 moins deux marges de 48px. */
const CONTENT_WIDTH = 1104;
const PWIN_SCALE = CONTENT_WIDTH / PWIN_WIDTH;

const CSS = `
@font-face {
  font-family: "Cabinet Grotesk";
  src: url("data:font/woff2;base64,${CABINET_GROTESK_BASE64}") format("woff2-variations");
  font-weight: 400 900;
  font-style: normal;
}

${DESIGN_TOKENS_CSS}

${HERO_DEMO_CSS}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  width: 1200px;
  height: 630px;
  overflow: hidden;
  font-family: var(--b-font-sans);
  color: var(--b-ink);
  background: var(--b-surface);
  -webkit-font-smoothing: antialiased;
}

.layout {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 32px 48px 0;
}

/* Lockup du header (marketingStyles.ts, .header__brand) agrandi : icône à
   ~1,5 fois la hauteur des capitales du nom, remontée de 1px pour que son
   centre tombe sur celui des capitales. */
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 28px;
  font-weight: var(--b-font-bold);
  letter-spacing: var(--b-tracking-tight);
  line-height: 1;
}
.brand__mark { height: 28px; width: auto; aspect-ratio: 27 / 25; flex: none; display: block; translate: 0 -1px; }

/* Le h1 du hero (marketingStyles.ts, .hero__title), à la taille de la carte. */
.headline {
  margin-top: 24px;
  max-width: 22ch;
  font-size: 60px;
  font-weight: var(--b-font-bold);
  line-height: var(--b-leading-none);
  letter-spacing: var(--b-tracking-tighter);
  text-wrap: balance;
}

.preview {
  position: relative;
  flex: 1;
  min-height: 0;
  margin-top: 36px;
}

/* La démo du hero réduite à sa fenêtre de plugin : plus de canvas ni de
   barre d'onglets Figma, plus de mise à l'échelle sur 1440px (son script
   pose --dm-scale, écrasé ici par l'échelle de la carte). */
.preview .dm { position: relative; width: 100%; height: 100%; aspect-ratio: auto; overflow: visible; background: none; border-radius: 0; }
.preview .dm-tabbar,
.preview .dm-canvas,
.preview .dm-cursor,
.preview .dm-shield { display: none !important; }
.preview .dm-stage { width: ${PWIN_WIDTH}px; height: auto; transform: scale(${PWIN_SCALE}) !important; }
.preview .dm-pwin { position: relative; left: 0; top: 0; }

/* Variante shadow : ombre dure à l'encre, contour 1px pour un bord net. */
.layout--shadow .dm-pwin { box-shadow: 0 0 0 1px var(--b-ink), 12px 12px 0 var(--b-ink); }

/* Variante shape : même géométrie que la fenêtre (rayon compris, à la même
   échelle), décalée vers le haut et collée aux bords droit et bas de la
   carte. Elle ne couvre pas toute la largeur : elle part du tiers de la
   fenêtre, à la manière d'un aplat qui entre dans le cadre. */
.preview__shape {
  position: absolute;
  top: -20px;
  left: 34%;
  right: -48px;
  bottom: 0;
  background: var(--b-accent);
  border-top-left-radius: calc(var(--b-radius-md) * ${PWIN_SCALE});
}
`;

/** HTML autonome (police, images et script de la démo inclus) prêt à être rasterisé. */
export function renderOgImageHtml(content: OgImageContent, variant: OgVariant): string {
  const markInner = DECKER_MARK_SVG.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>${CSS}</style>
</head>
<body>
<div class="layout layout--${variant}">
  <div class="brand">
    <svg class="brand__mark" viewBox="2 4 27 25" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${markInner}</svg>
    <span>Decker</span>
  </div>
  <h1 class="headline">${content.headline}</h1>
  <div class="preview">
    ${variant === 'shape' ? '<div class="preview__shape"></div>' : ''}
    ${HERO_DEMO_HTML}
  </div>
</div>
<script>${HERO_DEMO_JS}</script>
</body>
</html>`;
}
