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
  gap: var(--b-space-16); padding: var(--b-space-8) var(--b-space-16); border: 0;
  border-radius: var(--b-radius-md); color: var(--b-ink); font-size: var(--b-text-base);
  font-weight: var(--b-font-semibold); background-color: var(--b-accent);
}
.cta:hover { background-color: var(--b-accent-red); }
.tertiary {
  gap: var(--b-space-16); padding: var(--b-space-8) var(--b-space-16); border: 1px solid var(--b-border);
  border-radius: var(--b-radius-md); color: var(--b-ink); font-size: var(--b-text-base);
  font-weight: var(--b-font-semibold); background-color: transparent;
}
.tertiary:hover { background-color: var(--b-surface-muted); }

/* ---------- Links (b-button) ---------- */
.nav-link {
  font-size: var(--b-text-sm); font-weight: var(--b-font-medium); color: var(--b-text-muted);
  text-decoration: none; transition: color var(--b-duration-slow) ease-out;
}
.nav-link:hover, .nav-link[aria-current="page"] { color: var(--b-ink); }
.text-link {
  color: var(--b-ink); font-size: var(--b-text-xs); font-weight: var(--b-font-medium);
  text-decoration: none;
}
.text-link:hover { text-decoration: underline; }
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
.header__nav { display: flex; align-items: center; gap: var(--b-space-24); }
.header__actions { display: flex; align-items: center; gap: var(--b-space-20); }

/* ---------- Hero (b-hero) ---------- */
.hero {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: var(--b-space-20); width: 100%; max-width: 880px; margin-inline: auto;
  padding: var(--b-space-64) var(--b-space-24) var(--b-space-96);
}
.hero__title {
  margin: 0; font-size: var(--b-text-6xl); font-weight: var(--b-font-bold);
  line-height: var(--b-leading-none); letter-spacing: var(--b-tracking-tighter); color: var(--b-ink);
}
.hero__lede { margin: 0; max-width: 560px; font-size: var(--b-text-xl); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); }
.hero__actions { display: flex; align-items: center; justify-content: center; gap: var(--b-space-16); margin-top: var(--b-space-16); }
.hero__note { margin: 0; font-size: var(--b-text-sm); color: var(--b-text-faint); }

/* ---------- Content sections (prose — pas un composant Billel, besoin propre à cette page) ---------- */
.section { width: 100%; max-width: 720px; margin-inline: auto; padding: var(--b-space-48) var(--b-space-24); }
.section__title {
  margin: 0 0 var(--b-space-16); font-size: var(--b-text-3xl); font-weight: var(--b-font-bold);
  letter-spacing: var(--b-tracking-tight); color: var(--b-ink);
}
.section p { margin: 0 0 var(--b-space-16); font-size: var(--b-text-base); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); }
.section p:last-child { margin-bottom: 0; }
.section ul { margin: var(--b-space-8) 0 var(--b-space-16); padding-left: var(--b-space-24); }
.section li { font-size: var(--b-text-base); line-height: var(--b-leading-relaxed); color: var(--b-text-muted); margin-bottom: var(--b-space-8); }
.section--muted { background: var(--b-surface-muted); }
.legal .section { max-width: 680px; }
.legal .section__title--page { font-size: var(--b-text-3xl); text-align: center; padding-top: var(--b-space-32); }
.legal .meta { text-align: center; font-size: var(--b-text-xs); color: var(--b-text-faint); margin: 0 0 var(--b-space-48); }

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

@media (max-width: 720px) {
  .hero__title { font-size: 48px; }
  .header { flex-wrap: wrap; }
  .footer__top { flex-direction: column; }
  .footer__bottom { flex-direction: column; align-items: flex-start; }
}
`;
