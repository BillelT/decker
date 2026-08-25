import { Router } from 'express';
import { DECKER_FAVICON, DECKER_MARK_SVG, escapeHtml } from './brand.js';
import { MARKETING_CSS } from './marketingStyles.js';
import { OG_IMAGE_PNG_BASE64 } from '../og/ogImageData.js';
import { OG_IMAGE_VARIANTS, type OgImageVariant } from '../og/variants.js';

export const pagesRouter = Router();

const LAST_UPDATED = 'August 6, 2026';
const CONTACT_EMAIL = 'b.tighidet0@gmail.com';
/** Absolue plutôt que relative sur tous les liens vers /privacy et /terms : le check Google Branding ("App Homepage" guidance) compare cette URL telle quelle à celle configurée sur l'écran de consentement OAuth — une URL relative comme "/privacy" risque de ne pas matcher. */
const SITE_URL = 'https://decker.billeltighidet.fr';
const PLUGIN_URL = 'https://www.figma.com/community/plugin/1666774362264403763';
const FOLIO_URL = 'https://billeltighidet.fr';
const TWITTER_URL = 'https://x.com/billel_tighidet';
const COFFEE_URL = 'https://buymeacoffee.com/billelt';

/**
 * Facebook, LinkedIn et X mettent la carte de partage en cache la première
 * fois qu'ils voient une URL, parfois pour des semaines, et rien ne garantit
 * qu'un passage dans leur debugger la purge partout. Incrémenter ce numéro
 * après avoir regénéré les PNG (`npm run og:build`) change l'URL de l'image,
 * donc force un nouveau téléchargement partout, y compris là où le cache
 * n'est pas purgeable à la main. C'est aussi ce qui autorise le
 * `Cache-Control: immutable` d'un an posé plus bas.
 */
const OG_IMAGE_VERSION = '1';

/** Dimensions du PNG généré (cf. src/og/render.ts) — annoncées dans les
 *  balises `og:image:width/height` pour que les plateformes réservent la
 *  bonne place avant même d'avoir téléchargé l'image. */
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

/**
 * Absolue et non relative : la plupart des robots sociaux ne résolvent pas une
 * URL relative dans `og:image` et affichent alors une carte sans image.
 *
 * À noter, côté balises posées par `shell()` : la carte est annoncée en
 * `twitter:card = summary_large_image` et non `summary`, qui la rognerait au
 * carré pour n'en garder qu'une vignette. Seule l'image est répétée en
 * `twitter:*` — X et LinkedIn retombent sur les `og:*` pour le titre et la
 * description, mais certains clients ne lisent que `twitter:image`.
 */
const ogImageUrl = (variant: OgImageVariant): string =>
  `${SITE_URL}/${OG_IMAGE_VARIANTS[variant].file}?v=${OG_IMAGE_VERSION}`;

/** rel des liens sortants (convention b-signature du DS Billel) : mon domaine → noopener ; tiers → noopener noreferrer. */
const REL_OWN = 'noopener';
const REL_THIRD_PARTY = 'noopener noreferrer';

const brandMarkInline = (): string => DECKER_MARK_SVG.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

/**
 * DA "Billel" (design system perso, repo billel-skill, archétype b-marketing) :
 * header + hero + footer copiés depuis b-header.md/b-hero.md/b-footer.md,
 * remplace l'ancienne DA "hybrid" (une carte étroite unique, jugée pas assez
 * "vraie page web" par la revue Branding OAuth de Google — voir historique).
 */
function shell(opts: {
  title: string;
  description: string;
  path: string;
  jsonLdType: 'WebSite' | 'WebPage';
  ogImage: OgImageVariant;
  main: string;
}): string {
  const canonical = `${SITE_URL}${opts.path}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': opts.jsonLdType,
    name: opts.title,
    url: canonical,
    description: opts.description,
    image: ogImageUrl(opts.ogImage),
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="google-site-verification" content="bsri34RXa34pqM8rsNoUtVcV_jX0TmUwegbbFWpVLwQ" />
<meta name="description" content="${escapeHtml(opts.description)}" />
<link rel="canonical" href="${canonical}" />
<title>${escapeHtml(opts.title)}</title>
<link rel="icon" type="image/svg+xml" href="${DECKER_FAVICON}" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="Decker" />
<meta property="og:locale" content="en_US" />
<meta property="og:title" content="${escapeHtml(opts.title)}" />
<meta property="og:description" content="${escapeHtml(opts.description)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${ogImageUrl(opts.ogImage)}" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="${OG_IMAGE_WIDTH}" />
<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}" />
<meta property="og:image:alt" content="${escapeHtml(OG_IMAGE_VARIANTS[opts.ogImage].alt)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${ogImageUrl(opts.ogImage)}" />
<meta name="twitter:image:alt" content="${escapeHtml(OG_IMAGE_VARIANTS[opts.ogImage].alt)}" />

<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

<style>${MARKETING_CSS}</style>
</head>
<body>
${header(opts.path)}
<main>
${opts.main}
</main>
${footer()}
</body>
</html>`;
}

function header(currentPath: string): string {
  const navItem = (href: string, label: string): string =>
    `<a class="nav-link" href="${href}"${currentPath === href ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="header">
  <div class="header__lead">
    <a class="header__brand" href="/">
      <svg class="header__brand-mark" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${brandMarkInline()}</svg>
      Decker
    </a>
    <nav class="header__nav" aria-label="Primary">
      ${navItem('/privacy', 'Privacy')}
      ${navItem('/terms', 'Terms')}
    </nav>
  </div>
  <div class="header__actions">
    <a class="btn tertiary" href="${COFFEE_URL}" target="_blank" rel="${REL_THIRD_PARTY}">Buy me a coffee</a>
    <a class="btn cta" href="${PLUGIN_URL}" target="_blank" rel="${REL_THIRD_PARTY}">View on Figma</a>
  </div>
</header>`;
}

function footer(): string {
  return `<footer class="footer">
  <div class="footer__inner">
  <div class="footer__top">
    <div class="footer__brand">
      <div class="footer__brand-row">
        <svg class="footer__brand-mark" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${brandMarkInline()}</svg>
      </div>
      <p class="footer__meta">&copy; 2026 Decker<br>
        Made by <a class="text-link" href="${FOLIO_URL}" target="_blank" rel="${REL_OWN}">Billel</a>
      </p>
    </div>
    <div class="footer__cols">
      <nav class="footer__col" aria-label="Product">
        <h2 class="footer__col-title">Product</h2>
        <a class="nav-link" href="${PLUGIN_URL}" target="_blank" rel="${REL_THIRD_PARTY}">View on Figma</a>
        <a class="nav-link" href="${COFFEE_URL}" target="_blank" rel="${REL_THIRD_PARTY}">Buy me a coffee</a>
      </nav>
      <nav class="footer__col" aria-label="Connect">
        <h2 class="footer__col-title">Connect</h2>
        <a class="nav-link" href="${TWITTER_URL}" target="_blank" rel="${REL_THIRD_PARTY}">Twitter</a>
        <a class="nav-link" href="mailto:${CONTACT_EMAIL}">Email</a>
      </nav>
    </div>
  </div>
  <div class="footer__bottom">
    <p class="footer__note">Decker doesn't set cookies or collect personal data beyond what's needed to run an export.</p>
    <nav class="footer__legal" aria-label="Legal">
      <a class="nav-link" href="/privacy">Privacy Policy</a>
      <a class="nav-link" href="/terms">Terms of Use</a>
    </nav>
  </div>
  </div>
</footer>`;
}

pagesRouter.get('/', (_req, res) => {
  const main = `
    <section class="hero">
      <h1 class="hero__title">Decker</h1>
      <p class="hero__lede">Export a Figma design straight to Google Slides — layout, styles, and theme preserved.</p>
      <div class="hero__actions">
        <a class="btn cta" href="${PLUGIN_URL}" target="_blank" rel="${REL_THIRD_PARTY}">View the plugin on Figma</a>
      </div>
      <p class="hero__note">Free to use. Sign in with Google only when you're ready to export.</p>
    </section>

    <section class="section">
      <h2 class="section__title">What Decker does</h2>
      <p>Decker is a free Figma plugin that converts a Figma design into a real Google Slides presentation — text, shapes, images, colors, and typography are recreated as native Slides objects, not a flattened screenshot.</p>
    </section>

    <section class="section section--muted">
      <h2 class="section__title">How it works</h2>
      <p>From inside Figma, you pick the frames to export and sign in with your Google account. Decker then creates the presentation directly in your own Google Drive — nothing is published anywhere else.</p>
    </section>

    <section class="section">
      <h2 class="section__title">Why Decker asks for Google access</h2>
      <p>When you sign in, Decker requests three things, and nothing more:</p>
      <ul>
        <li><strong>Google Slides API</strong> — to create and populate the presentation you ask to export.</li>
        <li><strong>Google Drive API (<code>drive.file</code> scope)</strong> — limited to files created by Decker itself. Decker cannot read or modify any of your other Drive files.</li>
        <li><strong>Your email address</strong> — used only to display, inside the plugin, which Google account is currently connected.</li>
      </ul>
      <p>No data is stored beyond what's needed to run that export — full details in the <a class="text-link" href="${SITE_URL}/privacy">Privacy Policy</a>.</p>
    </section>
  `;
  res.type('html').send(
    shell({
      title: 'Decker',
      description: 'Decker is a free Figma plugin that exports a Figma design straight to Google Slides, preserving layout, styles, and theme.',
      path: '/',
      jsonLdType: 'WebSite',
      ogImage: 'home',
      main,
    }),
  );
});

pagesRouter.get('/privacy', (_req, res) => {
  const main = `
    <div class="legal">
      <section class="section">
        <h1 class="section__title section__title--page">Privacy Policy</h1>
        <p class="meta">Last updated: ${LAST_UPDATED}</p>

        <h2 class="section__title">What Decker does</h2>
        <p>Decker is a Figma plugin that converts a Figma design into a Google Slides presentation. To create that presentation in your Google account, Decker asks you to sign in with your Google account (OAuth).</p>

        <h2 class="section__title">Google data Decker accesses</h2>
        <ul>
          <li><strong>Google Slides API</strong> — to create and populate the presentation you ask to export.</li>
          <li><strong>Google Drive API (<code>drive.file</code> scope)</strong> — limited to files created by Decker itself. Decker cannot read or modify any of your other Drive files.</li>
          <li><strong>Email address</strong> — used only to display, inside the plugin, which Google account is currently connected.</li>
        </ul>

        <h2 class="section__title">What Decker doesn't do</h2>
        <p>Decker does not collect any data for analytics, advertising, or resale purposes. No third party has access to your data. The only processing performed is the strict technical minimum described below, needed to run the export you request.</p>

        <h2 class="section__title">Data retention</h2>
        <p>Images exported from Figma are hosted only for the duration of the export, then automatically deleted once the presentation is created (within one hour at most). Your Google refresh token is stored encrypted so you don't have to sign in again for every export; you can revoke it at any time from <a class="text-link" href="https://myaccount.google.com/permissions" target="_blank" rel="${REL_THIRD_PARTY}">myaccount.google.com/permissions</a>.</p>

        <h2 class="section__title">Contact</h2>
        <p>For any question about your data or a deletion request, write to <a class="text-link" href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
      </section>
    </div>
  `;
  res.type('html').send(
    shell({
      title: 'Decker — Privacy Policy',
      description: 'How Decker, a free Figma-to-Google-Slides plugin, handles your data.',
      path: '/privacy',
      jsonLdType: 'WebPage',
      ogImage: 'privacy',
      main,
    }),
  );
});

pagesRouter.get('/terms', (_req, res) => {
  const main = `
    <div class="legal">
      <section class="section">
        <h1 class="section__title section__title--page">Terms of Use</h1>
        <p class="meta">Last updated: ${LAST_UPDATED}</p>
        <p>Decker is a free plugin, provided "as is" without warranty of any kind, built as a personal project. You remain solely responsible for the content you export through the plugin.</p>
        <p>Using the plugin requires using your Google account via the OAuth authentication described in the <a class="text-link" href="${SITE_URL}/privacy">Privacy Policy</a>.</p>
        <p>Decker is free — if the plugin saves you time, a donation via <a class="text-link" href="${COFFEE_URL}" target="_blank" rel="${REL_THIRD_PARTY}">Buy me a coffee</a> is appreciated but never required.</p>
        <p>For any question, contact <a class="text-link" href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
      </section>
    </div>
  `;
  res.type('html').send(
    shell({
      title: 'Decker — Terms of Use',
      description: 'Terms of use for Decker, a free Figma-to-Google-Slides plugin.',
      path: '/terms',
      jsonLdType: 'WebPage',
      ogImage: 'terms',
      main,
    }),
  );
});

/**
 * Les PNG sont servis par la fonction elle-même, décodés depuis le base64 de
 * `og/ogImageData.ts` : Vercel réécrit ici toutes les routes (voir
 * vercel.json), il n'y a pas de dossier statique devant. Le cache d'un an est
 * sûr parce que l'URL porte un numéro de version (OG_IMAGE_VERSION) — un
 * nouveau visuel = une nouvelle URL.
 */
for (const [key, variant] of Object.entries(OG_IMAGE_VARIANTS)) {
  pagesRouter.get(`/${variant.file}`, (_req, res) => {
    res
      .type('png')
      .set('Cache-Control', 'public, max-age=31536000, immutable')
      .send(Buffer.from(OG_IMAGE_PNG_BASE64[key as OgImageVariant], 'base64'));
  });
}

pagesRouter.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
});

pagesRouter.get('/sitemap.xml', (_req, res) => {
  const urls = ['/', '/privacy', '/terms'];
  const body = urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc></url>`).join('\n');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
});
