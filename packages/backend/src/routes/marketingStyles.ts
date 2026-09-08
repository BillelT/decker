import { CABINET_GROTESK_BASE64 } from './fontData.js';

/**
 * DA "Billel" (design system perso, repo billel-skill) — archétype b-marketing :
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
  --b-gray-700: #575757;
  --b-gray-300: #cccccc;
  --b-gray-100: #eeeeee;
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

  --b-font-sans: "Cabinet Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --b-text-xs: 12px; --b-text-sm: 14px; --b-text-base: 16px; --b-text-lg: 18px;
  --b-text-xl: 20px; --b-text-3xl: 36px; --b-text-6xl: 72px;
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
     appliqué aux boutons — reste de marque (palette, layout, typo) inchangé. */
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
  width: 100%; max-width: 1200px; margin-inline: auto; padding: var(--b-space-16) var(--b-space-24);
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
   d'origine) — la colonne texte est plafonnée pour rester lisible, la
   colonne démo prend le reste de la largeur. */
.hero {
  display: grid; grid-template-columns: minmax(0, 460px) 1fr; align-items: center;
  gap: var(--b-space-64); width: 100%; max-width: 1200px; margin-inline: auto;
  padding: var(--b-space-96) var(--b-space-24);
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
.hero__note { margin: 0; font-size: var(--b-text-sm); color: var(--b-text-faint); text-wrap: balance; }
.hero__demo { width: 100%; }
/* 960x460 — ratio natif de la vidéo (how-it-works-demo.webm), pour que
   object-fit: cover (.demo-video) n'ait rien à recadrer. */
.hero__demo .demo-video { width: 100%; aspect-ratio: 960 / 460; }

/* ---------- Content sections (prose — pas un composant Billel, besoin propre à cette page) ---------- */
.section { width: 100%; max-width: 1200px; margin-inline: auto; padding: var(--b-space-64) var(--b-space-24); }
.section__title {
  margin: 0 0 var(--b-space-16); font-size: var(--b-text-3xl); font-weight: var(--b-font-bold);
  letter-spacing: var(--b-tracking-tight); color: var(--b-ink);
  text-wrap: balance;
}
.section__title--center { text-align: center; }
.section p { margin: 0 0 var(--b-space-16); font-size: var(--b-text-base); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); text-wrap: balance; }
.section p:last-child { margin-bottom: 0; }
.section ul { margin: var(--b-space-8) 0 var(--b-space-16); padding-left: var(--b-space-24); }
.section li { font-size: var(--b-text-base); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); margin-bottom: var(--b-space-8); text-wrap: balance; }
.legal .section { max-width: 680px; }
.legal .section__title--page { font-size: var(--b-text-3xl); text-align: center; padding-top: var(--b-space-32); }
.legal .meta { text-align: center; font-size: var(--b-text-xs); color: var(--b-text-faint); margin: 0 0 var(--b-space-48); text-wrap: balance; }

/* ---------- Feature grid (prose — cartes des points forts, pas un compo Billel) ---------- */
.feature-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--b-space-20);
  margin-top: var(--b-space-32);
}
.feature-card {
  display: flex; flex-direction: column; gap: var(--b-space-12);
  background: var(--b-surface-muted); border-radius: 0; padding: var(--b-space-24);
}
.feature-card__icon { width: 24px; height: 24px; color: var(--b-text-muted); }
.feature-card__title { margin: 0; font-size: var(--b-text-base); font-weight: var(--b-font-bold); color: var(--b-ink); text-wrap: balance; }
.feature-card__desc { margin: 0; font-size: var(--b-text-sm); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); text-wrap: balance; }

/* ---------- How it works — section pleine largeur (prose) ---------- */
.section--muted {
  width: 100%; max-width: none; padding: 0; background: var(--b-surface-muted);
}
.section--muted .section__inner { max-width: 1200px; margin-inline: auto; padding: var(--b-space-64) var(--b-space-24); }
.how-it-works {
  display: grid; grid-template-columns: 1fr 1fr; align-items: stretch;
  column-gap: var(--b-space-48); row-gap: var(--b-space-32); margin-top: var(--b-space-32);
}
.steps { grid-column: 1; grid-row: 1; display: flex; flex-direction: column; gap: var(--b-space-32); margin: 0; padding: 0; list-style: none; }
.steps__item { display: flex; gap: var(--b-space-16); align-items: flex-start; }
.steps__num {
  flex: 0 0 auto; display: flex; align-items: center; justify-content: center; line-height: 1;
  width: 32px; height: 32px; border-radius: 0;
  background: var(--b-accent-soft); color: var(--b-ink); font-size: var(--b-text-sm); font-weight: var(--b-font-bold);
}
.steps__title { margin: 0 0 var(--b-space-4); font-size: var(--b-text-lg); font-weight: var(--b-font-bold); color: var(--b-ink); text-wrap: balance; }
.steps__desc { margin: 0; font-size: var(--b-text-base); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); text-wrap: balance; }
.how-it-works__demo { grid-column: 2; grid-row: 1; }
.section__cta { grid-column: 1; grid-row: 2; align-self: start; justify-self: end; }

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
.footer__inner { max-width: 1200px; margin-inline: auto; padding: var(--b-space-48) var(--b-space-24); }
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

@media (max-width: 960px) {
  .feature-grid { grid-template-columns: repeat(2, 1fr); }
  .hero { grid-template-columns: 1fr; gap: var(--b-space-32); }
  .hero__content { align-items: center; text-align: center; }
  .hero__actions { justify-content: center; }
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
  .feature-grid { grid-template-columns: 1fr; }
  .how-it-works { grid-template-columns: 1fr; }
  .steps { grid-column: 1; grid-row: 1; }
  .how-it-works__demo { grid-column: 1; grid-row: 2; height: 280px; }
  .section__cta { grid-column: 1; grid-row: 3; justify-self: start; }
}
`;
