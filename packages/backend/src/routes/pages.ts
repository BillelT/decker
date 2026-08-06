import { Router } from 'express';
import { DECKER_FAVICON, DECKER_MARK_SVG, PERSONAL_MARK_SVG, X_MARK_SVG, escapeHtml } from './brand.js';

export const pagesRouter = Router();

const LAST_UPDATED = 'August 6, 2026';
const CONTACT_EMAIL = 'b.tighidet0@gmail.com';
const PLUGIN_URL = 'https://www.figma.com/community/plugin/1666774362264403763';
const FOLIO_URL = 'https://billeltighidet.fr';
const TWITTER_URL = 'https://x.com/billel_tighidet';
const COFFEE_URL = 'https://buymeacoffee.com/billelt';

/**
 * DA "hybrid" (palette de marque orange + biseaux/angles droits win95, mêmes
 * tokens que styles.hybrid.css et renderHybridPage dans auth.ts) — choisie
 * comme habillage par défaut de ces pages publiques : identifiable Decker
 * sans le chrome fenêtre rétro du skin win95, plus adaptée à un document
 * légal lu par un reviewer externe (Google) ou un visiteur hors plugin.
 */
function shell(title: string, bodyHtml: string, maxWidth = '440px'): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<link rel="icon" type="image/svg+xml" href="${DECKER_FAVICON}" />
<style>
  :root {
    color-scheme: light;
    --f2s-orange: #f06800;
    --f2s-orange-red: #f04000;
    --f2s-bg: #fff9f5;
    --f2s-surface: #ffffff;
    --f2s-text: #120f0d;
    --f2s-text-muted: rgba(18, 15, 13, 0.7);
    --hyb-hi: rgba(255, 255, 255, 0.9);
    --hyb-lo: rgba(18, 15, 13, 0.22);
    --hyb-lo-strong: rgba(18, 15, 13, 0.4);
    --hyb-out: inset -1px -1px var(--hyb-lo), inset 1px 1px var(--hyb-hi), inset -2px -2px var(--hyb-lo-strong), inset 2px 2px var(--hyb-hi);
    --hyb-pressed: inset -1px -1px var(--hyb-hi), inset 1px 1px var(--hyb-lo-strong), inset -2px -2px var(--hyb-hi), inset 2px 2px var(--hyb-lo);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    padding: 2.5rem 1.5rem;
    background: var(--f2s-bg);
    color: var(--f2s-text);
    font-family: 'Cabinet Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif;
  }
  .card {
    width: 100%;
    max-width: ${maxWidth};
    background: var(--f2s-surface);
    border-radius: 0;
    padding: 2.5rem 2.25rem;
    box-shadow: var(--hyb-out), 0 12px 32px rgba(18, 15, 13, 0.08);
  }
  .brand { display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 1.75rem; }
  .brand-mark { width: 28px; height: 28px; flex-shrink: 0; }
  .brand-name { font-size: 0.95rem; font-weight: 600; letter-spacing: 0.01em; }
  h1 { margin: 0 0 0.5rem; font-size: 1.5rem; font-weight: 700; text-align: center; }
  .tagline { margin: 0 0 1.75rem; color: var(--f2s-text-muted); font-size: 1rem; line-height: 1.5; text-align: center; }
  h2 { margin: 1.75rem 0 0.5rem; font-size: 1.02rem; font-weight: 700; }
  p, li { color: var(--f2s-text-muted); font-size: 0.92rem; line-height: 1.6; }
  ul { margin: 0.4rem 0; padding-left: 1.2rem; }
  a.link { color: var(--f2s-orange); font-weight: 600; text-decoration: none; }
  a.link:hover { text-decoration: underline; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%;
    padding: 0.85rem 1.25rem; border-radius: 0; background: var(--f2s-orange); color: #fff9f5;
    font-size: 0.95rem; font-weight: 700; text-decoration: none; border: none; cursor: pointer;
    box-shadow: var(--hyb-out); transition: background-color 0.15s ease;
  }
  .btn:hover { background: var(--f2s-orange-red); }
  .btn:active { box-shadow: var(--hyb-pressed); }
  .icon-row { display: flex; align-items: center; justify-content: center; gap: 0.9rem; margin-top: 1.5rem; }
  .icon-row a {
    display: flex; align-items: center; justify-content: center; gap: 0.45rem; height: 40px; padding: 0 0.85rem;
    background: var(--f2s-surface); color: var(--f2s-text); box-shadow: var(--hyb-out);
    text-decoration: none; font-size: 0.82rem; font-weight: 600; white-space: nowrap;
  }
  .icon-row a.icon-only { width: 40px; padding: 0; }
  .icon-row a:hover { color: var(--f2s-orange); }
  .icon-row svg { width: 18px; height: 18px; flex-shrink: 0; }
  .icon-row img { width: 18px; height: 18px; border-radius: 50%; display: block; flex-shrink: 0; }
  .icon-row .personal-mark { width: 21px; height: 21px; }
  .footer-nav { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.5rem 1rem; font-size: 0.82rem; }
  .footer-nav a { color: var(--f2s-text-muted); text-decoration: none; }
  .footer-nav a:hover { color: var(--f2s-orange); }
  .meta { text-align: center; font-size: 0.78rem; color: var(--f2s-text-muted); opacity: 0.8; margin: 0; }
</style>
</head>
<body>
  <main class="card">
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${DECKER_MARK_SVG.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>
      <span class="brand-name">Decker</span>
    </div>
    ${bodyHtml}
  </main>
</body>
</html>`;
}

function footerNav(): string {
  return `<nav class="footer-nav" style="margin-top: 1.75rem;">
    <a href="/privacy">Privacy Policy</a>
    <a href="/terms">Terms of Use</a>
    <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
  </nav>`;
}

pagesRouter.get('/', (_req, res) => {
  const body = `
    <h1>Decker</h1>
    <p class="tagline">Export a Figma design straight to Google Slides — layout, styles, and theme preserved.</p>

    <h2>What Decker does</h2>
    <p>Decker is a free Figma plugin that converts a Figma design into a real Google Slides presentation — text, shapes, images, colors, and typography are recreated as native Slides objects, not a flattened screenshot.</p>

    <h2>How it works</h2>
    <p>From inside Figma, you pick the frames to export and sign in with your Google account. Decker then creates the presentation directly in your own Google Drive using the Slides and Drive APIs — nothing is published anywhere else, and no Figma or Google data is stored beyond what's needed to run that export (see the <a class="link" href="/privacy">Privacy Policy</a>).</p>

    <a class="btn" href="${PLUGIN_URL}" target="_blank" rel="noopener">View the plugin on Figma</a>
    <div class="icon-row">
      <a class="icon-only" href="${FOLIO_URL}" target="_blank" rel="noreferrer" title="billeltighidet.fr">${PERSONAL_MARK_SVG.replace('<svg ', '<svg class="personal-mark" ')}</a>
      <a class="icon-only" href="${TWITTER_URL}" target="_blank" rel="noreferrer" title="@billel_tighidet">${X_MARK_SVG}</a>
      <a href="${COFFEE_URL}" target="_blank" rel="noreferrer" title="Buy me a coffee">Support me</a>
    </div>
    ${footerNav()}
  `;
  res.type('html').send(shell('Decker — Figma to Google Slides', body, '480px'));
});

pagesRouter.get('/privacy', (_req, res) => {
  const body = `
    <h1>Privacy Policy</h1>
    <p class="meta" style="margin-bottom: 1.5rem;">Last updated: ${LAST_UPDATED}</p>

    <h2>What Decker does</h2>
    <p>Decker is a Figma plugin that converts a Figma design into a Google Slides presentation. To create that presentation in your Google account, Decker asks you to sign in with your Google account (OAuth).</p>

    <h2>Google data Decker accesses</h2>
    <ul>
      <li><strong>Google Slides API</strong> — to create and populate the presentation you ask to export.</li>
      <li><strong>Google Drive API (<code>drive.file</code> scope)</strong> — limited to files created by Decker itself. Decker cannot read or modify any of your other Drive files.</li>
      <li><strong>Email address</strong> — used only to display, inside the plugin, which Google account is currently connected.</li>
    </ul>

    <h2>What Decker doesn't do</h2>
    <p>Decker does not collect any data for analytics, advertising, or resale purposes. No third party has access to your data. The only processing performed is the strict technical minimum described below, needed to run the export you request.</p>

    <h2>Data retention</h2>
    <p>Images exported from Figma are hosted only for the duration of the export, then automatically deleted once the presentation is created (within one hour at most). Your Google refresh token is stored encrypted so you don't have to sign in again for every export; you can revoke it at any time from <a class="link" href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">myaccount.google.com/permissions</a>.</p>

    <h2>Contact</h2>
    <p>For any question about your data or a deletion request, write to <a class="link" href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

    ${footerNav()}
  `;
  res.type('html').send(shell('Decker — Privacy Policy', body, '620px'));
});

pagesRouter.get('/terms', (_req, res) => {
  const body = `
    <h1>Terms of Use</h1>
    <p class="meta" style="margin-bottom: 1.5rem;">Last updated: ${LAST_UPDATED}</p>
    <p>Decker is a free plugin, provided "as is" without warranty of any kind, built as a personal project. You remain solely responsible for the content you export through the plugin.</p>
    <p>Using the plugin requires using your Google account via the OAuth authentication described in the <a class="link" href="/privacy">Privacy Policy</a>.</p>
    <p>Decker is free — if the plugin saves you time, a donation via <a class="link" href="${COFFEE_URL}" target="_blank" rel="noopener">Buy Me a Coffee</a> is appreciated but never required.</p>
    <p>For any question, contact <a class="link" href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
    ${footerNav()}
  `;
  res.type('html').send(shell('Decker — Terms of Use', body, '620px'));
});
