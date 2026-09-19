import { CABINET_GROTESK_BASE64 } from './fontData.js';

/**
 * DA "Billel" (design system perso, repo billel-skill), archétype b-marketing :
 * header + hero + footer "à copier tel quel" depuis b-header.md/b-hero.md/b-footer.md,
 * boutons/marqueurs depuis b-button.md/b-marker.md, tokens depuis token.css.
 * Remplace l'ancienne DA "hybrid" (carte étroite unique) : Google (revue Branding
 * OAuth) exigeait une vraie page d'accueil qui explique le produit, pas un dialogue
 * d'app. Sections `## Prose` (contenu texte, hors DS) ajoutées pour ce besoin précis,
 * pas de composant Billel dédié pour ça.
 */
export const MARKETING_CSS = `
@font-face {
  font-family: "Cabinet Grotesk";
  src: url("data:font/woff2;base64,${CABINET_GROTESK_BASE64}") format("woff2-variations");
  font-weight: 400 900;
  font-style: normal;
  font-display: swap;
}

:root {
  --b-black: #120f0d;
  --b-white: #fff9f5;
  --b-ink: #120f0d;
  --b-gray-700: #3b3735;
  --b-gray-300: #dcd5d0;
  --b-gray-100: #f1edeb;
  --b-text: var(--b-ink);
  --b-text-muted: var(--b-gray-700);
  --b-text-faint: var(--b-gray-700);
  --b-text-control: var(--b-gray-700);
  --b-surface: var(--b-white);
  --b-surface-muted: var(--b-gray-100);
  --b-surface-sunken: var(--b-gray-100);
  --b-border: var(--b-gray-300);
  --b-border-subtle: var(--b-gray-100);
  --b-accent: #f06800;
  --b-accent-red: #f04000;
  --b-accent-soft: #ffc599;
  --b-selection: rgba(240, 104, 0, 0.2);
  --b-scrollbar-thumb: rgba(0, 0, 0, .18);

  --b-space-2: 2px; --b-space-4: 4px; --b-space-6: 6px; --b-space-8: 8px;
  --b-space-12: 12px; --b-space-16: 16px; --b-space-20: 20px; --b-space-24: 24px;
  --b-space-32: 32px; --b-space-48: 48px; --b-space-64: 64px; --b-space-96: 96px;

  /* Conteneur des sections principales : pas de padding latéral, la marge auto
     fait le travail : 95% de large sous 1280px (soit 2.5% de marge de chaque
     côté), puis 1280px centrés au-delà. */
  --b-container: 1280px;
  --b-container-width: 95%;

  --b-font-sans: "Cabinet Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --b-text-xs: 12px; --b-text-sm: 14px; --b-text-base: 16px; --b-text-lg: 18px;
  --b-text-xl: 20px; --b-text-3xl: 36px; --b-text-4xl: 44px; --b-text-6xl: 72px;
  --b-font-regular: 400; --b-font-medium: 500; --b-font-semibold: 600; --b-font-bold: 700;
  --b-leading-none: 1.02; --b-leading-tight: 1.2; --b-leading-snug: 1.333;
  --b-leading-normal: 1.4; --b-leading-relaxed: 1.5;
  --b-tracking-tight: -.01em; --b-tracking-tighter: -.03em; --b-tracking-wide: .08em;

  --b-focus-outline: 2px solid var(--b-black);
  --b-focus-offset: 2px;
  --b-ease: cubic-bezier(.16, 1, .3, 1);
  --b-ease-default: cubic-bezier(.4, 0, .2, 1);
  --b-duration-instant: .05s; --b-duration-fast: .12s; --b-duration: .15s; --b-duration-slow: .2s;

  /* Biseau "hybride" (mêmes tokens que packages/plugin/src/styles.modern.css)
     appliqué aux boutons ; le reste de la marque (palette, layout, typo) est inchangé. */
  --hyb-hi: rgba(255, 255, 255, 0.9);
  --hyb-lo: rgba(18, 15, 13, 0.22);
  --hyb-lo-strong: rgba(18, 15, 13, 0.4);
  --hyb-out: inset -1px -1px var(--hyb-lo), inset 1px 1px var(--hyb-hi), inset -2px -2px var(--hyb-lo-strong),
    inset 2px 2px var(--hyb-hi);
  --hyb-pressed: inset -1px -1px var(--hyb-hi), inset 1px 1px var(--hyb-lo-strong), inset -2px -2px var(--hyb-hi),
    inset 2px 2px var(--hyb-lo);
}

* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  font-family: var(--b-font-sans);
  color: var(--b-text);
  background: var(--b-surface);
}
::selection { background: var(--b-selection); }
* { scrollbar-width: thin; scrollbar-color: var(--b-scrollbar-thumb) transparent; }
a { color: inherit; }

/* ---------- Buttons (b-button) ---------- */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; text-decoration: none; font-family: inherit;
  line-height: var(--b-leading-tight); white-space: nowrap; flex-shrink: 0;
  transition: background-color var(--b-duration) var(--b-ease-default),
    color var(--b-duration-fast) var(--b-ease-default),
    transform var(--b-duration-instant) var(--b-ease-default);
}
.btn:focus-visible { outline: var(--b-focus-outline); outline-offset: var(--b-focus-offset); }
.btn:active { transform: translateY(0.5px); }
.cta {
  gap: var(--b-space-16); padding: var(--b-space-6) var(--b-space-12); border: 0;
  border-radius: 0; color: var(--b-ink); font-size: var(--b-text-base);
  font-weight: var(--b-font-bold); background-color: var(--b-accent);
  box-shadow: var(--hyb-out);
}
.cta:hover { background-color: var(--b-accent-red); }
.cta:active { box-shadow: var(--hyb-pressed); }
.tertiary {
  gap: var(--b-space-16); padding: var(--b-space-6) var(--b-space-12); border: 1px solid transparent;
  border-radius: 0; color: var(--b-ink); font-size: var(--b-text-base);
  font-weight: var(--b-font-bold); background-color: transparent;
  box-shadow: var(--hyb-out);
}
.tertiary:hover { background-color: var(--b-surface-muted); }
.tertiary:active { box-shadow: var(--hyb-pressed); }

/* ---------- Links (b-button) ---------- */
.nav-link {
  font-size: var(--b-text-sm); font-weight: var(--b-font-medium); color: var(--b-text-muted);
  text-decoration: none; transition: color var(--b-duration-slow) ease-out;
}
.nav-link:hover, .nav-link[aria-current="page"] { color: var(--b-ink); }
.text-link {
  color: var(--b-ink); font: inherit; text-decoration: underline;
}
.nav-link:focus-visible, .text-link:focus-visible {
  outline: var(--b-focus-outline); outline-offset: var(--b-focus-offset); border-radius: 0;
}

/* ---------- Header (b-header, compo marketing) ---------- */
.header {
  position: sticky; top: 0; z-index: 20; width: 100%;
  background: var(--b-surface); border-bottom: 1px solid transparent;
  transition: border-color var(--b-duration-slow) ease-out;
}
.header--scrolled { border-bottom-color: var(--b-border); }
.header__inner {
  display: flex; align-items: center; justify-content: space-between; gap: var(--b-space-32);
  width: var(--b-container-width); max-width: var(--b-container); margin-inline: auto;
  padding-block: var(--b-space-16);
}
.header__lead { display: flex; align-items: center; gap: var(--b-space-32); }
.header__brand {
  display: inline-flex; align-items: center; gap: var(--b-space-8); color: var(--b-ink);
  font-size: var(--b-text-base); font-weight: var(--b-font-bold); letter-spacing: var(--b-tracking-tight);
  text-decoration: none;
}
.header__brand-mark { width: 24px; height: 24px; flex: 0 0 auto; display: block; }
.header__actions { display: flex; align-items: center; gap: var(--b-space-20); }

/* ---------- Hero (b-hero) ---------- */
/* Deux colonnes : titre/CTA à gauche, démo à droite (au lieu du bloc centré
   d'origine) : la colonne texte est plafonnée pour rester lisible, la
   colonne démo prend le reste de la largeur. */
.hero {
  display: grid; grid-template-columns: minmax(0, 460px) 1fr; align-items: center;
  gap: var(--b-space-64); width: var(--b-container-width); max-width: var(--b-container);
  margin-inline: auto; padding-block: var(--b-space-64);
}
.hero__content { display: flex; flex-direction: column; align-items: flex-start; text-align: left; gap: var(--b-space-20); }
.hero__title {
  margin: 0; font-size: var(--b-text-6xl); font-weight: var(--b-font-bold);
  line-height: var(--b-leading-none); letter-spacing: var(--b-tracking-tighter); color: var(--b-ink);
  text-wrap: balance;
}
.hero__lede { margin: 0; font-size: var(--b-text-xl); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); text-wrap: balance; }
.hero__actions { display: flex; align-items: center; justify-content: flex-start; gap: var(--b-space-16); margin-top: var(--b-space-16); }
.hero__actions .btn { padding: var(--b-space-12) var(--b-space-16); }
.hero__note { margin: 0; font-size: var(--b-text-sm); font-weight: var(--b-font-medium); color: var(--b-text-faint); text-wrap: balance; }
.hero__demo { width: 100%; }
/* 960x460, ratio natif de la vidéo (how-it-works-demo.webm), pour que
   object-fit: cover (.demo-video) n'ait rien à recadrer. */
.hero__demo .demo-video { width: 100%; aspect-ratio: 960 / 460; }

/* ---------- Content sections (prose, pas un composant Billel, besoin propre à cette page) ---------- */
.section {
  width: var(--b-container-width); max-width: var(--b-container); margin-inline: auto;
  padding-block: var(--b-space-64);
}
.section__eyebrow {
  margin: 0 0 var(--b-space-12); font-size: var(--b-text-sm); font-weight: var(--b-font-semibold);
  letter-spacing: var(--b-tracking-wide); text-transform: uppercase; color: var(--b-text-muted);
}
.section__title {
  margin: 0 0 var(--b-space-16); font-size: var(--b-text-4xl); font-weight: var(--b-font-bold);
  letter-spacing: var(--b-tracking-tight); color: var(--b-ink);
  text-wrap: balance;
}
/* Sur les pages légales, .section__title sert d'intertitre de prose et non
   d'accroche de section : il reste au palier du dessous. */
.legal .section__title { font-size: var(--b-text-3xl); }
/* Ces règles habillent le texte courant d'une section, et rien d'autre : d'où
   l'enfant direct et le :not([class]). Un simple .section p (0,1,1)
   l'emportait sur toute classe de composant (0,1,0) et débordait sur les
   cards et le carrousel : .section ul collait 24px de padding à la piste,
   ce qui empêchait le carrousel de revenir à scrollLeft 0, et .section p
   forçait les surtitres à 16px. Dire "un paragraphe sans classe" plutôt que
   "tout paragraphe" met tout composant à l'abri, présent comme futur. */
.section > p:not([class]) { margin: 0 0 var(--b-space-16); font-size: var(--b-text-base); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); text-wrap: balance; }
.section > p:not([class]):last-child { margin-bottom: 0; }
.section > ul { margin: var(--b-space-8) 0 var(--b-space-16); padding-left: var(--b-space-24); }
.section > ul > li { font-size: var(--b-text-base); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); margin-bottom: var(--b-space-8); text-wrap: balance; }
.legal .section { max-width: 680px; }
.legal .section__title--page { font-size: var(--b-text-3xl); text-align: center; padding-top: var(--b-space-32); }
.legal .meta { text-align: center; font-size: var(--b-text-xs); line-height: var(--b-leading-relaxed); color: var(--b-text-faint); margin: 0 0 var(--b-space-48); text-wrap: balance; }

/* ---------- How it works : les trois étapes, en grille ---------- */
.steps {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--b-space-20);
  margin: var(--b-space-32) 0 0; padding: 0; list-style: none;
}

/* ---------- Card (prose, un seul modèle pour "What Decker does" et "How it works") ----------
   Aperçu illustré en haut sur surface blanche, puis surtitre, titre et
   description. Les deux sections partagent le composant : seul le conteneur
   change (grille pour les étapes, piste défilante pour les points forts). */
.card {
  display: flex; flex-direction: column; gap: var(--b-space-24);
  background: var(--b-surface-muted); border-radius: 0; padding: var(--b-space-24);
}
/* Ratio fixe : les aperçus restent alignés entre eux quelle que soit la
   longueur des textes en dessous. */
.card__media {
  display: block; width: 100%; aspect-ratio: 8 / 5;
  background: var(--b-surface); border: 1px solid var(--b-border);
}
.card__body { display: flex; flex-direction: column; gap: var(--b-space-8); }
.card__eyebrow { margin: 0; font-size: var(--b-text-sm); font-weight: var(--b-font-medium); color: var(--b-text-faint); }
.card__title { margin: 0; font-size: var(--b-text-lg); font-weight: var(--b-font-bold); color: var(--b-ink); text-wrap: balance; }
.card__desc { margin: 0; font-size: var(--b-text-base); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); text-wrap: balance; }

/* ---------- Carrousel de cards (prose) ----------
   Six points forts : trop pour une grille lisible, donc une piste qui défile
   horizontalement, coupée net au bord du conteneur. La card partiellement
   visible à droite signale qu'il y en a d'autres ; les flèches sont sous la
   piste, alignées sur la marge droite du conteneur. */
.carousel__track {
  display: flex; gap: var(--b-space-20); margin: var(--b-space-32) 0 0; padding: 0; list-style: none;
  overflow-x: auto; overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory; scroll-behavior: smooth;
  scrollbar-width: none;
}
.carousel__track::-webkit-scrollbar { display: none; }
/* La card suivante doit toujours dépasser : c'est le seul signal qu'il y a
   une suite. La largeur est donc calculee pour qu'un nombre entier de cards
   ne remplisse jamais la piste, plutot qu'avec un clamp, dont les bornes
   finissaient par coincider avec la largeur de piste (a 960px, la borne basse
   laissait 12px de depassement, soit un liseré qui passait pour un bug).
   Trois cards a 31% de la piste occupent 93% plus deux gouttieres : il reste
   exactement 7% de piste pour laisser voir la quatrieme, quelle que soit la
   largeur. Les paliers en dessous suivent la meme logique avec deux cards
   (10% de depassement) puis une (20%). */
.carousel__item { flex: 0 0 calc(31% - 20px); scroll-snap-align: start; }
.carousel__controls { display: flex; justify-content: flex-end; gap: var(--b-space-8); margin-top: var(--b-space-48); }
.carousel__btn {
  width: 40px; height: 40px; padding: 0; border: 0; border-radius: 0;
  background-color: var(--b-surface-muted); color: var(--b-ink); box-shadow: var(--hyb-out);
}
.carousel__btn:hover:not(:disabled) { background-color: var(--b-gray-300); }
.carousel__btn:active:not(:disabled) { box-shadow: var(--hyb-pressed); }
.carousel__btn:disabled { color: var(--b-gray-300); cursor: default; }
.carousel__btn:disabled:active { transform: none; }
.carousel__btn svg { width: 20px; height: 20px; display: block; }

.section__cta { display: flex; justify-content: flex-end; margin-top: var(--b-space-32); }

/* ---------- Demo video (illustration "how it works") ---------- */
.demo-video {
  display: block; width: 100%; height: 100%; min-height: 220px;
  object-fit: cover; border-radius: 0;
  border: 1px solid var(--b-border); background: var(--b-surface-muted);
}

/* ---------- Footer (b-footer, compo marketing) ---------- */
.footer {
  width: 100%; border-top: 1px solid var(--b-border);
}
.footer__inner {
  width: var(--b-container-width); max-width: var(--b-container); margin-inline: auto;
  padding-block: var(--b-space-48);
}
.footer__top { display: flex; justify-content: space-between; gap: var(--b-space-48); margin-bottom: var(--b-space-64); flex-wrap: wrap; }
.footer__brand { display: flex; flex-direction: column; align-items: flex-start; gap: var(--b-space-16); }
.footer__brand-row { display: flex; align-items: center; gap: var(--b-space-12); }
.footer__brand-mark { width: 24px; height: 24px; flex: 0 0 auto; display: block; }
.footer__meta { margin: 0; font-size: var(--b-text-xs); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); text-wrap: balance; }
.footer__cols { display: flex; gap: var(--b-space-64); flex-wrap: wrap; }
.footer__col { display: flex; flex-direction: column; gap: var(--b-space-12); }
.footer__col-title { margin: 0 0 var(--b-space-4); font-size: var(--b-text-sm); font-weight: var(--b-font-semibold); color: var(--b-ink); }
.footer__bottom {
  display: flex; justify-content: space-between; align-items: center; gap: var(--b-space-24);
  padding-top: var(--b-space-32); border-top: 1px solid var(--b-border); flex-wrap: wrap;
}
.footer__note { margin: 0; font-size: var(--b-text-xs); color: var(--b-text-muted); text-wrap: balance; }
.footer__legal { display: flex; gap: var(--b-space-24); }

@media (prefers-reduced-motion: reduce) {
  .carousel__track { scroll-behavior: auto; }
}

@media (max-width: 960px) {
  .steps { grid-template-columns: repeat(2, 1fr); }
  .carousel__item { flex-basis: calc(45% - 20px); }
  .hero { grid-template-columns: 1fr; gap: var(--b-space-32); }
  .hero__content { align-items: center; text-align: center; }
  .hero__actions { justify-content: center; }
}

@media (max-width: 640px) {
  .carousel__item { flex-basis: calc(80% - 16px); }
}

@media (max-width: 720px) {
  .hero__title { font-size: 48px; }
  /* Le brand et les boutons ne tiennent plus sur une seule ligne : au lieu de
     laisser les boutons se compresser (leur texte passait alors sur deux
     lignes), la ligne d'actions passe entièrement sous le brand. */
  .header__inner { flex-wrap: wrap; row-gap: var(--b-space-12); }
  .header__actions { width: 100%; }
  .footer__top { flex-direction: column; }
  .footer__bottom { flex-direction: column; align-items: flex-start; }
  .steps { grid-template-columns: 1fr; }
  .section__cta { justify-content: flex-start; }
}
`;
