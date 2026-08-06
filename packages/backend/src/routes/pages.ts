import { Router } from 'express';
import { COFFEE_MARK_SVG, DECKER_FAVICON, DECKER_MARK_SVG, PERSONAL_MARK_SVG, X_MARK_SVG, escapeHtml } from './brand.js';

export const pagesRouter = Router();

const LAST_UPDATED = '6 août 2026';
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
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<link rel="icon" type="image/svg+xml" href="${DECKER_FAVICON}" />
<style>
  :root {
    color-scheme: light;
    --f2s-orange: #f06800;
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
    box-shadow: var(--hyb-out);
  }
  .btn:active { box-shadow: var(--hyb-pressed); }
  .icon-row { display: flex; align-items: center; justify-content: center; gap: 0.9rem; margin-top: 1.5rem; }
  .icon-row a {
    display: flex; align-items: center; justify-content: center; width: 40px; height: 40px;
    background: var(--f2s-surface); color: var(--f2s-text); box-shadow: var(--hyb-out);
  }
  .icon-row a:hover { color: var(--f2s-orange); }
  .icon-row svg { width: 18px; height: 18px; }
  .icon-row img { width: 20px; height: 20px; border-radius: 50%; display: block; }
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
    <a href="/privacy">Politique de confidentialité</a>
    <a href="/terms">Conditions d'utilisation</a>
    <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>
  </nav>`;
}

pagesRouter.get('/', (_req, res) => {
  const body = `
    <h1>Decker</h1>
    <p class="tagline">Exporte une maquette Figma en présentation Google Slides — mise en page, styles et thème conservés.</p>
    <a class="btn" href="${PLUGIN_URL}" target="_blank" rel="noopener">Voir le plugin sur Figma</a>
    <div class="icon-row">
      <a href="${FOLIO_URL}" target="_blank" rel="noreferrer" title="billeltighidet.fr">${PERSONAL_MARK_SVG.replace('<svg ', '<svg style="width:40px;height:40px" ')}</a>
      <a href="${TWITTER_URL}" target="_blank" rel="noreferrer" title="@billel_tighidet">${X_MARK_SVG}</a>
      <a href="${COFFEE_URL}" target="_blank" rel="noreferrer" title="Buy me a coffee">${COFFEE_MARK_SVG}</a>
    </div>
    ${footerNav()}
  `;
  res.type('html').send(shell('Decker — Figma vers Google Slides', body, '420px'));
});

pagesRouter.get('/privacy', (_req, res) => {
  const body = `
    <h1>Politique de confidentialité</h1>
    <p class="meta" style="margin-bottom: 1.5rem;">Dernière mise à jour : ${LAST_UPDATED}</p>

    <h2>Ce que fait Decker</h2>
    <p>Decker est un plugin Figma qui convertit une maquette Figma en présentation Google Slides. Pour créer cette présentation dans votre compte Google, Decker vous demande de vous connecter avec votre compte Google (OAuth).</p>

    <h2>Données Google auxquelles Decker accède</h2>
    <ul>
      <li><strong>Google Slides API</strong> — pour créer et remplir la présentation que vous demandez d'exporter.</li>
      <li><strong>Google Drive API (scope <code>drive.file</code>)</strong> — accès limité aux seuls fichiers créés par Decker. Decker ne peut pas lire ni modifier vos autres fichiers Drive.</li>
      <li><strong>Adresse e-mail</strong> — utilisée uniquement pour afficher, dans le plugin, quel compte Google est connecté.</li>
    </ul>

    <h2>Ce que Decker ne fait pas</h2>
    <p>Decker ne collecte aucune donnée à des fins d'analyse, de publicité ou de revente. Aucun tiers n'a accès à vos données. Le seul traitement effectué est le strict nécessaire technique décrit ci-dessous, pour faire fonctionner l'export que vous demandez.</p>

    <h2>Conservation des données</h2>
    <p>Les images exportées depuis Figma sont hébergées le temps de l'export puis supprimées automatiquement une fois la présentation créée (au maximum une heure). Le jeton de connexion Google (refresh token) est stocké chiffré pour vous éviter de vous reconnecter à chaque export ; vous pouvez le révoquer à tout moment depuis <a class="link" href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">myaccount.google.com/permissions</a>.</p>

    <h2>Contact</h2>
    <p>Pour toute question sur vos données ou une demande de suppression, écrivez à <a class="link" href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

    ${footerNav()}
  `;
  res.type('html').send(shell('Decker — Politique de confidentialité', body, '620px'));
});

pagesRouter.get('/terms', (_req, res) => {
  const body = `
    <h1>Conditions d'utilisation</h1>
    <p class="meta" style="margin-bottom: 1.5rem;">Dernière mise à jour : ${LAST_UPDATED}</p>
    <p>Decker est un plugin gratuit, fourni "tel quel" sans garantie d'aucune sorte, développé dans le cadre d'un projet personnel. Vous restez seul responsable du contenu que vous exportez via le plugin.</p>
    <p>L'usage du plugin implique l'usage de votre compte Google via l'authentification OAuth décrite dans la <a class="link" href="/privacy">politique de confidentialité</a>.</p>
    <p>Decker est gratuit — si le plugin vous fait gagner du temps, un don via <a class="link" href="${COFFEE_URL}" target="_blank" rel="noopener">Buy Me a Coffee</a> est apprécié mais jamais requis.</p>
    <p>Pour toute question, contactez <a class="link" href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
    ${footerNav()}
  `;
  res.type('html').send(shell("Decker — Conditions d'utilisation", body, '620px'));
});
