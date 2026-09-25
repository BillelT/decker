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
 * internes (--hyb-out/--hyb-in/--hyb-pressed) et angles droits.
 *
 * Mise en page en pile plutôt qu'en deux colonnes : logo en haut à gauche
 * (repère de page, pas un élément centré avec le reste), accroche pleine
 * largeur juste en dessous, aperçu du produit pleine largeur sous
 * l'accroche, tous trois dans la même marge latérale de page (48px). Seul
 * le bas de l'aperçu déborde volontairement de cette marge, jusqu'au bord
 * de la carte, comme une photo qui dépasse du cadre plutôt qu'un élément de
 * plus contenu dans la page. Sur le fond crème --b-white : la carte EST un
 * extrait de la page, pas une simulation de logiciel. Pas de nom de produit
 * écrit en toutes lettres : le logo (icône seule) fait déjà cette
 * identification, un "Decker" en gros n'aurait fait que répéter
 * l'information sans rien ajouter à la vignette.
 *
 * L'aperçu du produit (.demo) est une recréation HTML/CSS du panneau réel du
 * plugin (skin Modern, packages/plugin/src/styles.css + styles.modern.css),
 * pas une capture d'écran bitmap : les classes, libellés et couleurs
 * ci-dessous sont recopiés depuis ces fichiers et depuis ui.tsx (topbar,
 * onglets Deck/Templates, rail de vignettes, canvas). Rasterisée en même
 * temps que le reste de la carte (voir l'en-tête ci-dessus), elle reste
 * nette à n'importe quelle taille d'affichage, contrairement à l'ancienne
 * capture PNG (assets/tool-preview-source.png, retirée), qui pixellisait en
 * grand format et se périmait à chaque changement de l'UI réelle.
 *
 * Contraintes de la carte de partage, qui expliquent les valeurs ci-dessous :
 * - 1200x630 (ratio 1.91:1), la seule taille sûre sur Facebook/LinkedIn/X ;
 * - le texte (logo, accroche) et les côtés de l'aperçu restent dans une
 *   marge de page ; seul le bas de l'aperçu va jusqu'au bord, quitte à
 *   être rogné selon la plateforme : il ne porte aucune information à
 *   préserver ;
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
import {
  DEMO_SLIDE_INTRO_JPEG_BASE64,
  DEMO_SLIDE_PILLARS_PNG_BASE64,
  DEMO_SLIDE_CONCLUSION_JPEG_BASE64,
} from './demoSlideImages.js';
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
   pages HTML rendues côté serveur (auth.ts). --b-border/--b-surface-muted
   recopiés de --color-border/--color-surface-muted (styles.css du plugin). */
:root {
  --b-ink: #120f0d;
  --b-white: #fff9f5;
  --b-surface: #ffffff;
  --b-surface-muted: #f2ece8;
  --b-border: #f1edeb;
  --b-scrollbar: #dcd5d0;
  --b-muted: rgba(18, 15, 13, 0.7);
  --b-accent: #f06800;
  --b-accent-red: #f04000;
  --b-accent-soft: #ffc599;

  --hyb-hi: rgba(255, 255, 255, 0.9);
  --hyb-lo: rgba(18, 15, 13, 0.22);
  --hyb-lo-strong: rgba(18, 15, 13, 0.4);
  --hyb-out: inset -1px -1px var(--hyb-lo), inset 1px 1px var(--hyb-hi), inset -2px -2px var(--hyb-lo-strong),
    inset 2px 2px var(--hyb-hi);
  --hyb-in: inset -1px -1px var(--hyb-hi), inset 1px 1px var(--hyb-lo), inset -2px -2px var(--hyb-hi),
    inset 2px 2px var(--hyb-lo-strong);
  --hyb-pressed: inset -1px -1px var(--hyb-hi), inset 1px 1px var(--hyb-lo-strong), inset -2px -2px var(--hyb-hi),
    inset 2px 2px var(--hyb-lo);
  --hyb-etched: inset -1px -1px var(--hyb-hi), inset 1px 1px var(--hyb-lo);
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
  padding: 32px 48px 0;
}

.header-block {
  flex: none;
}

/* Logo seul (icône de marque), à la même marge du bord haut que le
   padding latéral : un repère de page en haut à gauche, pas un élément
   centré avec le reste du contenu. */
.logo__mark { width: 72px; height: 72px; flex: none; display: block; }

/* Pleine largeur sous le logo plutôt que dans une colonne partagée avec
   l'aperçu : une seule ligne d'accroche large se lit plus vite en vignette
   qu'un bloc de texte étroit sur plusieurs lignes. */
.headline {
  margin: 16px 0 0;
  font-size: 52px;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: var(--b-ink);
  text-wrap: balance;
}

/* Aperçu du produit plutôt que la marque en grand : montrer le panneau du
   plugin en train de préparer un export parle plus qu'une icône statique.
   Pleine largeur dans la marge de page (comme le logo et l'accroche), mais
   déborde jusqu'au bord bas de la carte (pas de padding bas sur .layout) et
   occupe toute la hauteur restante : le panneau .demo est plus grand que la
   place disponible (comme le vrai panneau du plugin, qui défile), overflow
   masque le surplus au lieu de le comprimer. Puits en creux (--hyb-in),
   comme .card__media du site et .f2s-frame-preview du plugin lui-même : le
   panneau n'y porte jamais de bordure, seul l'enfoncement le distingue du
   crème qui l'entoure. */
.preview {
  flex: 1;
  min-height: 0;
  margin-top: 16px;
  padding: 5px;
  background: var(--b-surface);
  box-shadow: var(--hyb-in);
  overflow: hidden;
}

/* ============================================================================
   Recréation du panneau du plugin (skin Modern) : mêmes classes logiques que
   packages/plugin/src/styles.css + styles.modern.css, valeurs recopiées
   telles quelles (tailles, paddings, couleurs), voir l'en-tête du fichier.
   ============================================================================ */
.demo {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  font-size: 12px;
  background: var(--b-white);
}

.demo-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 16px 0;
  flex: none;
}
.demo-topbar-left { display: flex; align-items: center; gap: 16px; }

.demo-tabs { display: inline-flex; gap: 2px; padding: 2px; background: var(--b-surface-muted); border: 1px solid var(--b-border); }
.demo-tab { font-size: 12px; font-weight: 700; color: var(--b-muted); padding: 5px 14px; }
.demo-tab.is-active { background: var(--b-white); color: var(--b-ink); box-shadow: var(--hyb-pressed); }

.demo-title-group { display: flex; align-items: center; gap: 8px; }
.demo-label { font-size: 12px; font-weight: 700; color: var(--b-muted); white-space: nowrap; }
.demo-input { font-size: 12px; color: var(--b-muted); background: var(--b-surface); box-shadow: var(--hyb-in); padding: 3px 8px; width: 150px; }

.demo-topbar-actions { display: flex; align-items: center; gap: 16px; }
/* Bordure transparente en base (comme .f2s-btn) : chaque variante redéfinit
   sa couleur, sauf primary qui la garde transparente (le fond orange suffit) :
   même déclaration sur les trois évite un écart de taille entre boutons. */
.demo-btn { font-size: 13px; font-weight: 700; padding: 8px 16px; white-space: nowrap; border: 1px solid transparent; box-shadow: var(--hyb-out); }
.demo-btn--tertiary { background: transparent; color: var(--b-ink); border-color: var(--b-ink); }
.demo-btn--secondary { background: transparent; color: var(--b-accent); border-color: var(--b-accent); }
.demo-btn--primary { background: var(--b-accent); color: var(--b-white); }

.demo-toolbar { display: flex; align-items: center; gap: 8px; padding: 12px 16px; flex: none; }
.demo-muted { font-size: 12px; font-weight: 500; color: var(--b-muted); }
.demo-font-select { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
.demo-font-original,
.demo-font-arrow { color: var(--b-muted); }
.demo-font-dropdown { font-size: 12px; font-weight: 700; color: var(--b-ink); background: var(--b-surface); box-shadow: var(--hyb-in); padding: 3px 8px; }

.demo-body { flex: 1; min-height: 0; display: flex; border-top: 1px solid var(--b-border); }

.demo-sidebar { flex: none; width: 190px; padding: 8px 16px 16px; display: flex; flex-direction: column; gap: 16px; border-right: 1px solid var(--b-border); }
.demo-thumb { aspect-ratio: 16 / 9; width: 100%; box-shadow: var(--hyb-in); border: 2px solid transparent; background: var(--b-surface-muted); overflow: hidden; position: relative; }
.demo-thumb.is-active { border-color: var(--b-accent-red); }
.demo-thumb__index { position: absolute; left: 0; bottom: -18px; font-size: 12px; color: var(--b-muted); }

.demo-canvas { flex: 1; min-width: 0; padding: 20px 24px; display: flex; flex-direction: column; align-items: center; gap: 24px; }
.demo-canvas-preview { width: 100%; max-width: 640px; aspect-ratio: 16 / 9; border: 1px solid var(--b-scrollbar); overflow: hidden; position: relative; flex: none; }

.demo-dims { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--b-muted); flex: none; }
.demo-dim-box { box-shadow: var(--hyb-in); background: var(--b-surface); padding: 2px 10px; min-width: 24px; text-align: center; color: var(--b-ink); }

/* ---- Rapport "Content" (voir .f2s-logs / .f2s-log-entry de styles.css) ---- */
.demo-logs { width: 100%; max-width: 640px; flex: none; display: flex; flex-direction: column; gap: 8px; background: var(--b-surface); box-shadow: var(--hyb-etched); padding: 12px 16px; }
.demo-logs-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.demo-logs-title { font-size: 13px; font-weight: 700; }
.demo-log-entry { display: flex; align-items: center; gap: 8px; width: 100%; font-size: 12px; color: var(--b-ink); background: var(--b-border); box-shadow: var(--hyb-out); padding: 6px 10px; }
.demo-log-entry-name { flex: 1 1 auto; min-width: 0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.demo-log-entry-flag { flex: 0 0 auto; font-size: 9px; font-weight: 700; letter-spacing: 0.01em; padding: 2px 6px; background: var(--b-accent-soft); color: var(--b-ink); }

/* Contenu de la vignette de slide (thumb + grand aperçu partagent ce
   gabarit) : une vraie image du deck de démo "Trailworn" (voir
   assets/mockup slides/ et demoSlideImages.ts), pas un mock dessiné en
   CSS : le rail de vignettes et le canvas ont exactement la même proportion
   16:9 que ces images, cover les remplit donc sans rogner. */
.slide { position: absolute; inset: 0; background-size: cover; background-position: center; }
`;

function slideImage(base64: string, mimeType: 'jpeg' | 'png'): string {
  return `<div class="slide" style="background-image:url('data:image/${mimeType};base64,${base64}')"></div>`;
}

/** Recrée le panneau du plugin (skin Modern) : mêmes libellés que ui.tsx/DeckPanel.tsx. */
function renderDemoHtml(): string {
  return `<div class="demo">
  <div class="demo-topbar">
    <div class="demo-topbar-left">
      <div class="demo-tabs" role="tablist">
        <span class="demo-tab is-active">Deck</span>
        <span class="demo-tab">Templates</span>
      </div>
      <div class="demo-title-group">
        <span class="demo-label">Name:</span>
        <span class="demo-input">Decker export</span>
      </div>
    </div>
    <div class="demo-topbar-actions">
      <span class="demo-btn demo-btn--tertiary">Select frames to add</span>
      <span class="demo-btn demo-btn--secondary">Prepare for Slides</span>
      <span class="demo-btn demo-btn--primary">Export</span>
    </div>
  </div>
  <div class="demo-toolbar">
    <span class="demo-label">Fonts:</span>
    <span class="demo-font-select">
      <span class="demo-font-original">General Sans Variable</span>
      <span class="demo-font-arrow">→</span>
      <span class="demo-font-dropdown">Inter</span>
    </span>
  </div>
  <div class="demo-body">
    <div class="demo-sidebar">
      <div class="demo-thumb is-active">${slideImage(DEMO_SLIDE_INTRO_JPEG_BASE64, 'jpeg')}</div>
      <div class="demo-thumb">${slideImage(DEMO_SLIDE_PILLARS_PNG_BASE64, 'png')}</div>
      <div class="demo-thumb">${slideImage(DEMO_SLIDE_CONCLUSION_JPEG_BASE64, 'jpeg')}</div>
    </div>
    <div class="demo-canvas">
      <div class="demo-canvas-preview">${slideImage(DEMO_SLIDE_INTRO_JPEG_BASE64, 'jpeg')}</div>
      <div class="demo-dims">
        <span>Dimensions :</span>
        <span class="demo-dim-box">1920</span>
        <span>×</span>
        <span class="demo-dim-box">1080</span>
        <span>px</span>
      </div>
      <div class="demo-logs">
        <div class="demo-logs-header">
          <span class="demo-logs-title">Content</span>
          <span class="demo-muted">16 native · 0 rasterized</span>
        </div>
        <div class="demo-log-entry">
          <span class="demo-log-entry-name">Built for the long run.</span>
          <span class="demo-log-entry-flag">General Sans Variable → Inter</span>
        </div>
        <div class="demo-log-entry">
          <span class="demo-log-entry-name">BRAND CASE STUDY</span>
          <span class="demo-log-entry-flag">General Sans Variable → Inter</span>
        </div>
      </div>
    </div>
  </div>
</div>`;
}

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
  <div class="header-block">
    ${markInline}
    <h1 class="headline">${content.headline}</h1>
  </div>
  <div class="preview">
    ${renderDemoHtml()}
  </div>
</div>
</body>
</html>`;
}
