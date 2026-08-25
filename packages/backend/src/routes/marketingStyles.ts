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
  --b-selection: rgba(240, 104, 0, 0.2);
  --b-scrollbar-thumb: rgba(0, 0, 0, .18);

  --b-space-2: 2px; --b-space-4: 4px; --b-space-6: 6px; --b-space-8: 8px;
  --b-space-12: 12px; --b-space-16: 16px; --b-space-20: 20px; --b-space-24: 24px;
  --b-space-32: 32px; --b-space-48: 48px; --b-space-64: 64px; --b-space-96: 96px;

  --b-radius-2xs: 2px; --b-radius-xs: 4px; --b-radius-sm: 6px; --b-radius-md: 8px;
  --b-radius-lg: 32px; --b-radius-full: 9999px;

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

  /* Chrome Windows 95, repris tel quel de src/og/ogTemplate.ts pour la démo
     "how it works" — seul endroit de la page marketing qui cite cette DA. */
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
  line-height: var(--b-leading-tight);
  transition: background-color var(--b-duration) var(--b-ease-default),
    color var(--b-duration-fast) var(--b-ease-default),
    transform var(--b-duration-instant) var(--b-ease-default);
}
.btn:focus-visible { outline: var(--b-focus-outline); outline-offset: var(--b-focus-offset); }
.btn:active { transform: translateY(0.5px); }
.cta {
  gap: var(--b-space-16); padding: var(--b-space-6) var(--b-space-12); border: 0;
  border-radius: var(--b-radius-md); color: var(--b-ink); font-size: var(--b-text-base);
  font-weight: var(--b-font-bold); background-color: var(--b-accent);
}
.cta:hover { background-color: var(--b-accent-red); }
.tertiary {
  gap: var(--b-space-16); padding: var(--b-space-6) var(--b-space-12); border: 1px solid var(--b-border);
  border-radius: var(--b-radius-md); color: var(--b-ink); font-size: var(--b-text-base);
  font-weight: var(--b-font-bold); background-color: transparent;
}
.tertiary:hover { background-color: var(--b-surface-muted); }

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
  outline: var(--b-focus-outline); outline-offset: var(--b-focus-offset); border-radius: var(--b-radius-2xs);
}

/* ---------- Header (b-header, compo marketing) ---------- */
.header {
  display: flex; align-items: center; justify-content: space-between; gap: var(--b-space-32);
  width: 100%; max-width: 1200px; margin-inline: auto; padding: var(--b-space-20) var(--b-space-24);
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
.hero {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: var(--b-space-20); width: 100%; max-width: 880px; margin-inline: auto;
  padding: var(--b-space-96) var(--b-space-24);
}
.hero__title {
  margin: 0; font-size: var(--b-text-6xl); font-weight: var(--b-font-bold);
  line-height: var(--b-leading-none); letter-spacing: var(--b-tracking-tighter); color: var(--b-ink);
}
.hero__lede { margin: 0; max-width: 560px; font-size: var(--b-text-xl); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); }
.hero__actions { display: flex; align-items: center; justify-content: center; gap: var(--b-space-16); margin-top: var(--b-space-16); }
.hero__actions .btn { padding: var(--b-space-12) var(--b-space-16); }
.hero__note { margin: 0; font-size: var(--b-text-sm); color: var(--b-text-faint); }

/* ---------- Content sections (prose — pas un composant Billel, besoin propre à cette page) ---------- */
.section { width: 100%; max-width: 720px; margin-inline: auto; padding: var(--b-space-64) var(--b-space-24); }
.section--wide { max-width: 960px; }
.section__title {
  margin: 0 0 var(--b-space-16); font-size: var(--b-text-3xl); font-weight: var(--b-font-bold);
  letter-spacing: var(--b-tracking-tight); color: var(--b-ink);
}
.section__title--center { text-align: center; }
.section p { margin: 0 0 var(--b-space-16); font-size: var(--b-text-base); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); }
.section p:last-child { margin-bottom: 0; }
.section ul { margin: var(--b-space-8) 0 var(--b-space-16); padding-left: var(--b-space-24); }
.section li { font-size: var(--b-text-base); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); margin-bottom: var(--b-space-8); }
.legal .section { max-width: 680px; }
.legal .section__title--page { font-size: var(--b-text-3xl); text-align: center; padding-top: var(--b-space-32); }
.legal .meta { text-align: center; font-size: var(--b-text-xs); color: var(--b-text-faint); margin: 0 0 var(--b-space-48); }

/* ---------- Feature grid (prose — cartes des points forts, pas un compo Billel) ---------- */
.feature-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--b-space-20);
  margin-top: var(--b-space-32);
}
.feature-card {
  display: flex; flex-direction: column; gap: var(--b-space-12);
  background: var(--b-surface-muted); border-radius: var(--b-radius-md); padding: var(--b-space-24);
}
.feature-card__icon { width: 24px; height: 24px; color: var(--b-text-muted); }
.feature-card__title { margin: 0; font-size: var(--b-text-base); font-weight: var(--b-font-bold); color: var(--b-ink); }
.feature-card__desc { margin: 0; font-size: var(--b-text-sm); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); }

/* ---------- How it works — section pleine largeur (prose) ---------- */
.section--muted {
  width: 100%; max-width: none; padding: 0; background: var(--b-surface-muted);
}
.section--muted .section__inner { max-width: 960px; margin-inline: auto; padding: var(--b-space-64) var(--b-space-24); }
.how-it-works { display: flex; align-items: center; gap: var(--b-space-48); margin-top: var(--b-space-32); }
.how-it-works__content { flex: 1 1 380px; }
.how-it-works__demo { flex: 1 1 380px; }
.steps { display: flex; flex-direction: column; gap: var(--b-space-32); margin: 0; padding: 0; list-style: none; }
.steps__item { display: flex; gap: var(--b-space-16); align-items: flex-start; }
.steps__num {
  flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: var(--b-radius-full);
  background: var(--b-accent); color: var(--b-ink); font-size: var(--b-text-sm); font-weight: var(--b-font-bold);
}
.steps__title { margin: 0 0 var(--b-space-4); font-size: var(--b-text-lg); font-weight: var(--b-font-bold); color: var(--b-ink); }
.steps__desc { margin: 0; font-size: var(--b-text-base); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); }
.section__cta { margin-top: var(--b-space-32); }

/* ---------- Démo win95 (illustration "how it works") ---------- */
.win95-window {
  width: 100%; max-width: 380px; margin-inline: auto; padding: 4px;
  display: flex; flex-direction: column; background: var(--w95-face); box-shadow: var(--w95-out);
}
.win95-titlebar {
  height: 32px; flex: none; display: flex; align-items: center; gap: 8px; padding: 0 4px 0 8px;
  background: linear-gradient(90deg, var(--w95-navy) 0%, var(--w95-navy-light) 100%);
}
.win95-titlebar__icon { width: 18px; height: 18px; flex: none; display: block; }
.win95-titlebar__label { flex: 1; font-family: Tahoma, "Segoe UI", Arial, sans-serif; font-size: 13px; font-weight: 700; color: #fff; }
.win95-titlebar__buttons { display: flex; gap: 3px; }
.win95-titlebar__btn {
  width: 18px; height: 16px; display: flex; align-items: flex-end; justify-content: center;
  padding-bottom: 3px; background: var(--w95-face); box-shadow: var(--w95-out);
}
.win95-titlebar__btn span { display: block; width: 8px; height: 2px; background: #000; }
.win95-titlebar__btn--box span { height: 6px; border: 1px solid #000; border-top-width: 2px; background: none; }
.win95-titlebar__btn--close { align-items: center; padding-bottom: 0; }
.win95-titlebar__btn--close svg { width: 9px; height: 9px; display: block; }
.win95-client { margin-top: 4px; padding: 4px; background: var(--w95-face); box-shadow: var(--w95-in); }
.win95-paper { padding: var(--b-space-16); background: var(--b-white); display: flex; flex-direction: column; gap: var(--b-space-12); }
.win95-label {
  margin: 0; font-size: var(--b-text-xs); font-weight: var(--b-font-semibold); color: var(--b-text-muted);
  text-transform: uppercase; letter-spacing: var(--b-tracking-wide);
}
.win95-list { display: flex; flex-direction: column; gap: var(--b-space-8); margin: 0; padding: 0; list-style: none; }
.win95-list__item { display: flex; align-items: center; gap: var(--b-space-8); font-size: var(--b-text-sm); color: var(--b-ink); }
.win95-checkbox { width: 14px; height: 14px; flex: none; position: relative; background: var(--b-white); box-shadow: var(--w95-in); }
.win95-checkbox--checked::after {
  content: ""; position: absolute; left: 3px; top: 3px; width: 8px; height: 8px; background: var(--w95-navy);
}
.win95-divider { height: 1px; margin: var(--b-space-4) 0; background: var(--w95-shadow); box-shadow: 0 1px var(--w95-white); }
.win95-row { display: flex; align-items: center; gap: var(--b-space-8); }
.win95-avatar {
  width: 22px; height: 22px; flex: none; border-radius: var(--b-radius-full); background: var(--b-accent);
  color: #fff; font-size: var(--b-text-xs); font-weight: var(--b-font-bold); display: flex; align-items: center; justify-content: center;
}
.win95-row__text { font-size: var(--b-text-xs); color: var(--b-text-muted); }
.win95-btn {
  align-self: flex-start; margin-top: var(--b-space-4); padding: var(--b-space-6) var(--b-space-16);
  background: var(--w95-face); box-shadow: var(--w95-out); font-size: var(--b-text-sm); font-weight: var(--b-font-bold); color: #000;
}
.win95-statusbar {
  height: 22px; flex: none; margin-top: 4px; display: flex; align-items: center; padding: 0 8px;
  box-shadow: inset -1px -1px var(--w95-white), inset 1px 1px var(--w95-shadow);
  font-family: Tahoma, "Segoe UI", Arial, sans-serif; font-size: 11px; font-weight: 700; color: #000;
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
.footer__meta { margin: 0; font-size: var(--b-text-xs); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); }
.footer__cols { display: flex; gap: var(--b-space-64); flex-wrap: wrap; }
.footer__col { display: flex; flex-direction: column; gap: var(--b-space-12); }
.footer__col-title { margin: 0 0 var(--b-space-4); font-size: var(--b-text-sm); font-weight: var(--b-font-semibold); color: var(--b-ink); }
.footer__bottom {
  display: flex; justify-content: space-between; align-items: center; gap: var(--b-space-24);
  padding-top: var(--b-space-32); border-top: 1px solid var(--b-border); flex-wrap: wrap;
}
.footer__note { margin: 0; font-size: var(--b-text-xs); color: var(--b-text-muted); }
.footer__legal { display: flex; gap: var(--b-space-24); }

@media (max-width: 960px) {
  .feature-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 720px) {
  .hero__title { font-size: 48px; }
  .header { flex-wrap: wrap; }
  .footer__top { flex-direction: column; }
  .footer__bottom { flex-direction: column; align-items: flex-start; }
  .feature-grid { grid-template-columns: 1fr; }
  .how-it-works { flex-direction: column; align-items: stretch; }
}
`;
