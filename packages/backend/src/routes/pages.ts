import { Router } from 'express';
import { DECKER_FAVICON, DECKER_MARK_SVG, escapeHtml } from './brand.js';
import { MARKETING_CSS } from './marketingStyles.js';
import { OG_IMAGE_PNG_BASE64 } from '../og/ogImageData.js';
import { OG_IMAGE } from '../og/variants.js';
import { HERO_DEMO_CSS, HERO_DEMO_HTML, HERO_DEMO_JS } from './heroDemo.js';
import { EASTER_EGG_VERSION, easterEggScript } from './easterEgg.js';
import {
  FEATURE_FREE_SVG,
  FEATURE_FULL_DECK_SVG,
  FEATURE_NATIVE_SVG,
  FEATURE_PICK_SVG,
  FEATURE_PRIVATE_SVG,
  FEATURE_TEMPLATE_SVG,
  STEP_GET_DECK_SVG,
  STEP_MATCHED_SVG,
  STEP_PICK_FRAMES_SVG,
} from './artwork.js';

export const pagesRouter = Router();

const LAST_UPDATED = 'September 1, 2026';
const CONTACT_EMAIL = 'b.tighidet0@gmail.com';
/** Absolue plutôt que relative sur tous les liens vers /privacy et /terms : le check Google Branding ("App Homepage" guidance) compare cette URL telle quelle à celle configurée sur l'écran de consentement OAuth, et une URL relative comme "/privacy" risque de ne pas matcher. */
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
const OG_IMAGE_VERSION = '16';

/** Dimensions du PNG généré (cf. src/og/render.ts), annoncées dans les
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
 * `twitter:*` : X et LinkedIn retombent sur les `og:*` pour le titre et la
 * description, mais certains clients ne lisent que `twitter:image`.
 */
const OG_IMAGE_URL = `${SITE_URL}/${OG_IMAGE.file}?v=${OG_IMAGE_VERSION}`;

/** rel des liens sortants (convention b-signature du DS Billel) : mon domaine → noopener ; tiers → noopener noreferrer. */
const REL_OWN = 'noopener';
const REL_THIRD_PARTY = 'noopener noreferrer';

/**
 * Logo du footer, déclencheur de l'easter egg (voir easterEgg.ts) : le même
 * dessin que DECKER_MARK_SVG, mais découpé en trois groupes, une carte par
 * groupe, pour que l'animation de survol les ferme et les rouvre comme des
 * fenêtres en boucle. À garder aligné sur DECKER_MARK_SVG (brand.ts).
 */
const FOOTER_EGG_MARK = `<svg class="footer__brand-mark" viewBox="0 0 32 32" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<g class="egg-card egg-card--back"><rect x="3" y="15" width="20" height="14" fill="#7a3b12" stroke="#1a0d02" stroke-width="1"/></g>
<g class="egg-card egg-card--mid"><rect x="6" y="10" width="20" height="14" fill="#c1651c" stroke="#1a0d02" stroke-width="1"/></g>
<g class="egg-card egg-card--front">
<rect x="9" y="5" width="20" height="14" fill="#ffb238" stroke="#1a0d02" stroke-width="1"/>
<rect x="9" y="5" width="20" height="1" fill="#fff4d6"/>
<rect x="9" y="5" width="1" height="14" fill="#fff4d6"/>
<rect x="10.5" y="6.5" width="17" height="3.2" fill="#1a0d02"/>
<rect x="10.5" y="12" width="17" height="2" fill="#fff4d6"/>
<rect x="10.5" y="15" width="11" height="2" fill="#fff4d6"/>
<path d="M26 5 L29 5 L29 8 Z" fill="#1a0d02"/>
<path d="M26 5 L28 5 L28 7 Z" fill="#fff4d6"/>
</g>
</svg>`;

const brandMarkInline = (): string => DECKER_MARK_SVG.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

/**
 * DA "Billel" (design system perso, repo billel-skill, archétype b-marketing) :
 * header + hero + footer copiés depuis b-header.md/b-hero.md/b-footer.md,
 * remplace l'ancienne DA "hybrid" (une carte étroite unique, jugée pas assez
 * "vraie page web" par la revue Branding OAuth de Google, voir historique).
 */
function shell(opts: {
  title: string;
  description: string;
  path: string;
  jsonLdType: 'WebSite' | 'WebPage';
  main: string;
  /** Styles propres à la page (la démo du hero n'alourdit que l'accueil). */
  styles?: string;
  /** Script propre à la page, posé après le script commun. */
  script?: string;
}): string {
  const canonical = `${SITE_URL}${opts.path}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': opts.jsonLdType,
    name: opts.title,
    url: canonical,
    description: opts.description,
    image: OG_IMAGE_URL,
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="color-scheme" content="light" />
<meta name="theme-color" content="#fbfaf9" />
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
<meta property="og:image" content="${OG_IMAGE_URL}" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="${OG_IMAGE_WIDTH}" />
<meta property="og:image:height" content="${OG_IMAGE_HEIGHT}" />
<meta property="og:image:alt" content="${escapeHtml(OG_IMAGE.alt)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${OG_IMAGE_URL}" />
<meta name="twitter:image:alt" content="${escapeHtml(OG_IMAGE.alt)}" />

<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

<style>${MARKETING_CSS}</style>
${opts.styles ? `<style>${opts.styles}</style>\n` : ''}</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${header()}
<main id="main" tabindex="-1">
${opts.main}
</main>
${footer()}
<script>
(function () {
  var header = document.querySelector('.header');
  if (!header) return;
  var onScroll = function () {
    header.classList.toggle('header--scrolled', window.scrollY > 0);
  };
  onScroll();
  document.addEventListener('scroll', onScroll, { passive: true });

  // Easter egg du footer : le jeu n'est chargé qu'au premier clic sur le logo.
  var egg = document.querySelector('[data-egg]');
  if (egg) {
    var eggLoading = false;
    egg.addEventListener('click', function () {
      if (window.DeckerEgg) { window.DeckerEgg.open(egg); return; }
      if (eggLoading) return;
      eggLoading = true;
      var script = document.createElement('script');
      script.src = '/easter-egg.js?v=${EASTER_EGG_VERSION}';
      script.onload = function () { if (window.DeckerEgg) window.DeckerEgg.open(egg); };
      script.onerror = function () { eggLoading = false; };
      document.head.appendChild(script);
    });
  }

  // Carrousel de cards. La piste défile déjà nativement (tactile, trackpad,
  // clavier) : le script n'ajoute que les flèches, et les masque tant que tout
  // tient à l'écran, pour ne pas afficher deux boutons morts.
  document.querySelectorAll('[data-carousel]').forEach(function (carousel) {
    var track = carousel.querySelector('[data-carousel-track]');
    var controls = carousel.querySelector('[data-carousel-controls]');
    var prev = carousel.querySelector('[data-carousel-prev]');
    var next = carousel.querySelector('[data-carousel-next]');
    var item = track && track.firstElementChild;
    if (!track || !controls || !prev || !next || !item) return;

    // Une card à la fois : le pas vaut une card plus sa gouttière.
    var stride = function () {
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return item.getBoundingClientRect().width + gap;
    };

    var update = function () {
      // 1px de tolérance : scrollLeft est fractionnaire dès que le zoom ou la
      // densité d'écran ne tombe pas juste, et n'atteint jamais l'entier exact.
      var max = track.scrollWidth - track.clientWidth;
      controls.hidden = max <= 1;
      track.classList.toggle('carousel__track--grabbable', max > 1);
      prev.disabled = track.scrollLeft <= 1;
      next.disabled = track.scrollLeft >= max - 1;
    };

    prev.addEventListener('click', function () { track.scrollBy({ left: -stride() }); });
    next.addEventListener('click', function () { track.scrollBy({ left: stride() }); });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    // Glisser à la souris ou au stylet. Le tactile est laissé au défilement
    // natif du navigateur, qui gère déjà l'inertie et l'accrochage bien mieux
    // qu'un suivi manuel.
    var dragFrom = 0;
    var scrollFrom = 0;
    var dragging = false;
    var stopDrag = function (event) {
      if (!dragging) return;
      dragging = false;
      if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
      // Retirer la classe rend son scroll-snap à la piste, donc l'accrochage
      // sur la card la plus proche se fait ici, au relâchement.
      track.classList.remove('carousel__track--dragging');
    };
    track.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'touch' || event.button !== 0) return;
      dragging = true;
      dragFrom = event.clientX;
      scrollFrom = track.scrollLeft;
      track.setPointerCapture(event.pointerId);
      track.classList.add('carousel__track--dragging');
      // Sans ça, un glisser amorcé sur un texte de card démarre une sélection
      // de texte native, qui prend la main et fait perdre le glisser. La piste
      // est une surface à tirer : la sélection y cède le pas.
      event.preventDefault();
    });
    track.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      track.scrollLeft = scrollFrom - (event.clientX - dragFrom);
    });
    track.addEventListener('pointerup', stopDrag);
    track.addEventListener('pointercancel', stopDrag);
    // Sans ça, le navigateur lance son propre glisser-déposer sur les SVG des
    // aperçus dès le premier pixel, et le glisser de la piste s'interrompt.
    track.addEventListener('dragstart', function (event) { event.preventDefault(); });

    update();
  });
})();
</script>
${opts.script ? `<script>${opts.script}</script>` : ''}
</body>
</html>`;
}

function header(): string {
  return `<header class="header">
  <div class="header__inner">
    <div class="header__lead">
      <a class="header__brand" href="/">
        <svg class="header__brand-mark" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${brandMarkInline()}</svg>
        Decker
      </a>
    </div>
    <nav class="header__nav" aria-label="Page sections">
      <a class="nav-link" href="/#what-decker-does">What it does</a>
      <a class="nav-link" href="/#how-it-works">How it works</a>
      <a class="nav-link" href="/#google-access">Google access</a>
    </nav>
    <div class="header__actions">
      <a class="btn secondary" href="${COFFEE_URL}" target="_blank" rel="${REL_THIRD_PARTY}">Buy me a coffee</a>
      <a class="btn cta" href="${PLUGIN_URL}" target="_blank" rel="${REL_THIRD_PARTY}">Try it on Figma</a>
    </div>
  </div>
</header>`;
}

function footer(): string {
  return `<footer class="footer">
  <div class="footer__inner">
  <div class="footer__top">
    <div class="footer__brand">
      <div class="footer__brand-row">
        <button type="button" class="footer__egg" data-egg aria-labelledby="footer-egg-tip">
          ${FOOTER_EGG_MARK}
          <span class="footer__egg-tip" id="footer-egg-tip">Click to get spammed like it’s 2003</span>
        </button>
      </div>
      <p class="footer__meta">&copy; 2026 Decker<br>
        Made by <a class="text-link" href="${FOLIO_URL}" target="_blank" rel="${REL_OWN}">Billel</a>
      </p>
    </div>
    <div class="footer__cols">
      <nav class="footer__col" aria-label="Product">
        <h2 class="footer__col-title">Product</h2>
        <a class="nav-link" href="${PLUGIN_URL}" target="_blank" rel="${REL_THIRD_PARTY}">Try it on Figma</a>
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
    <p class="footer__note">Decker doesn’t set cookies or collect personal data beyond what’s needed to run an export.</p>
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
      <h1 class="hero__title">Export editable, pixel perfect decks and templates</h1>
      <div class="hero__row">
        <p class="hero__lede">Design in the comfort of Figma, then share with your clients on Google Slides.</p>
        <div class="hero__actions">
          <a class="btn cta" href="${PLUGIN_URL}" target="_blank" rel="${REL_THIRD_PARTY}">Try it on Figma</a>
        </div>
      </div>
      <div class="hero__demo">
        ${HERO_DEMO_HTML}
      </div>
    </section>

    <section class="section section--bleed" id="what-decker-does">
      <div class="section__inner">
        <p class="section__eyebrow">What Decker does</p>
        <h2 class="section__title">Free, complete, and fully editable.</h2>
      </div>
      <div class="carousel" data-carousel>
        <ul class="carousel__track" data-carousel-track tabindex="0" aria-label="What Decker does">
        <li class="carousel__item card">
          ${FEATURE_FREE_SVG}
          <div class="card__body">
            <p class="card__eyebrow">Pricing</p>
            <h3 class="card__title">100% free</h3>
            <p class="card__desc">No paywall, no subscription, no trial. Free to use, today and tomorrow.</p>
          </div>
        </li>
        <li class="carousel__item card">
          ${FEATURE_FULL_DECK_SVG}
          <div class="card__body">
            <p class="card__eyebrow">Full deck</p>
            <h3 class="card__title">Export a whole file</h3>
            <p class="card__desc">Send a Figma file to Slides frame by frame, as one real deck, not one slide at a time.</p>
          </div>
        </li>
        <li class="carousel__item card">
          ${FEATURE_TEMPLATE_SVG}
          <div class="card__body">
            <p class="card__eyebrow">Templates</p>
            <h3 class="card__title">Export a template</h3>
            <p class="card__desc">Turn your frames into a reusable Slides template: theme colors, fonts, layouts, and real placeholders.</p>
          </div>
        </li>
        <li class="carousel__item card">
          ${FEATURE_PICK_SVG}
          <div class="card__body">
            <p class="card__eyebrow">Control</p>
            <h3 class="card__title">Pick what you export</h3>
            <p class="card__desc">Choose exactly which frames to send, right from inside Figma, before you sign in.</p>
          </div>
        </li>
        <li class="carousel__item card">
          ${FEATURE_NATIVE_SVG}
          <div class="card__body">
            <p class="card__eyebrow">Fidelity</p>
            <h3 class="card__title">Real Slides objects</h3>
            <p class="card__desc">Text, shapes, colors, and typography are recreated as native, editable objects instead of a flattened screenshot.</p>
          </div>
        </li>
        <li class="carousel__item card">
          ${FEATURE_PRIVATE_SVG}
          <div class="card__body">
            <p class="card__eyebrow">Privacy</p>
            <h3 class="card__title">Private by default</h3>
            <p class="card__desc">Nothing is stored beyond what’s needed to run the export. No tracking, no analytics.</p>
          </div>
        </li>
        </ul>
        <div class="section__inner carousel__controls" data-carousel-controls>
          <button type="button" class="btn carousel__btn" data-carousel-prev aria-label="Show previous features">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15,5 8,12 15,19" /></svg>
          </button>
          <button type="button" class="btn carousel__btn" data-carousel-next aria-label="Show next features">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9,5 16,12 9,19" /></svg>
          </button>
        </div>
      </div>
    </section>

    <section class="section" id="how-it-works">
      <p class="section__eyebrow">How it works</p>
      <h2 class="section__title">Three steps to a live deck.</h2>
      <ol class="card-grid">
        <li class="card">
          ${STEP_PICK_FRAMES_SVG}
          <div class="card__body">
            <p class="card__eyebrow">Step 1</p>
            <h3 class="card__title">Pick your frames</h3>
            <p class="card__desc">From inside Figma, select the frames you want to export.</p>
          </div>
        </li>
        <li class="card">
          ${STEP_MATCHED_SVG}
          <div class="card__body">
            <p class="card__eyebrow">Step 2</p>
            <h3 class="card__title">Matched, pixel for pixel</h3>
            <p class="card__desc">Every layer, font, and color is mapped precisely into native Slides objects.</p>
          </div>
        </li>
        <li class="card">
          ${STEP_GET_DECK_SVG}
          <div class="card__body">
            <p class="card__eyebrow">Step 3</p>
            <h3 class="card__title">Get your deck</h3>
            <p class="card__desc">Decker creates the presentation directly in your own Google Drive, ready to edit.</p>
          </div>
        </li>
      </ol>
      <div class="section__cta">
        <a class="btn cta" href="${PLUGIN_URL}" target="_blank" rel="${REL_THIRD_PARTY}">Try it on Figma</a>
      </div>
    </section>

    <section class="section" id="google-access">
      <p class="section__eyebrow">Why Decker asks for Google access</p>
      <h2 class="section__title">Only what the export needs.</h2>
      <ul class="card-grid">
        <li class="card card--compact">
          <div class="card__body">
            <h3 class="card__title">Create the deck, nothing else</h3>
            <p class="card__desc">Decker only touches the presentation it creates for you. It cannot read or modify any other file in your Drive or Slides.</p>
          </div>
          <p class="card__note">Scope <code>drive.file</code></p>
        </li>
        <li class="card card--compact">
          <div class="card__body">
            <h3 class="card__title">Show which account is connected</h3>
            <p class="card__desc">Your email address is displayed inside the plugin, so you always know where an export is about to land.</p>
          </div>
          <p class="card__note">Scope <code>userinfo.email</code></p>
        </li>
        <li class="card card--compact">
          <div class="card__body">
            <h3 class="card__title">Nothing kept after the export</h3>
            <p class="card__desc">No data is stored beyond what’s needed to run that export. No tracking, no analytics, no resale.</p>
          </div>
          <p class="card__note"><a class="text-link" href="${SITE_URL}/privacy">Read the Privacy Policy</a></p>
        </li>
      </ul>
    </section>
  `;
  res.type('html').send(
    shell({
      title: 'Decker',
      description: 'Decker is a free Figma plugin that exports a Figma design straight to Google Slides, preserving layout, styles, and theme.',
      path: '/',
      jsonLdType: 'WebSite',
      main,
      styles: HERO_DEMO_CSS,
      script: HERO_DEMO_JS,
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
          <li><strong>Google Drive API (<code>drive.file</code> scope)</strong>: limited to files created by Decker itself. This is what lets Decker create and populate the presentation you ask to export through the Google Slides API; Decker cannot read or modify any of your other Drive or Slides files.</li>
          <li><strong>Email address</strong>: used only to display, inside the plugin, which Google account is currently connected.</li>
        </ul>

        <h2 class="section__title">What Decker doesn’t do</h2>
        <p>Decker does not collect any data for analytics, advertising, or resale purposes. Decker does not sell or transfer Google user data to third parties, and does not use Google user data to train or improve AI/ML models, whether generalized or personalized. No third party has access to your data. The only processing performed is the strict technical minimum described below, needed to run the export you request.</p>

        <h2 class="section__title">How Decker protects your data</h2>
        <ul>
          <li><strong>Encryption in transit</strong>: every connection between the plugin, Decker’s backend, and Google’s APIs is made over HTTPS/TLS. Decker never transmits your credentials or tokens over an unencrypted channel.</li>
          <li><strong>Encryption at rest</strong>: your Google refresh token is never stored in plain text. It’s encrypted with AES-256-GCM before being written to storage, using a secret key that only Decker’s backend holds.</li>
          <li><strong>No standing access to your files</strong>: Decker only touches the Google Slides presentation it creates for you (via the <code>drive.file</code> scope). It cannot browse, read, or modify any other file in your Drive.</li>
          <li><strong>Signed, time-limited URLs</strong>: images generated during an export are served through short-lived signed URLs (see retention below) so that they can’t be accessed after their purpose is served.</li>
          <li><strong>Access control</strong>: only Decker’s backend service can decrypt your refresh token or access exported assets; there is no admin dashboard or bulk export of user data.</li>
        </ul>

        <h2 class="section__title">Data retention and deletion</h2>
        <ul>
          <li><strong>Google refresh token and account email</strong>: kept encrypted for up to 90 days of inactivity so you don’t have to sign in again for every export, and deleted immediately when you sign out of the plugin or disconnect Decker from <a class="text-link" href="https://myaccount.google.com/permissions" target="_blank" rel="${REL_THIRD_PARTY}">myaccount.google.com/permissions</a>. An inactive session expires and is deleted automatically after 90 days.</li>
          <li><strong>Exported images</strong>: hosted only for the duration of the export and automatically deleted within at most 1 hour of being generated, whether or not the export succeeds.</li>
          <li><strong>Export job status</strong> (progress/result of a single export): automatically deleted after 24 hours.</li>
          <li><strong>Sign-in state</strong> (temporary OAuth data used only while you’re completing the Google sign-in flow): automatically deleted after 10 minutes.</li>
          <li>You can request deletion of any data Decker holds about you at any time, in addition to disconnecting Decker from your Google account. See Contact below.</li>
        </ul>

        <h2 class="section__title">Contact</h2>
        <p>For any question about your data or a deletion request, write to <a class="text-link" href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
      </section>
    </div>
  `;
  res.type('html').send(
    shell({
      title: 'Decker: Privacy Policy',
      description: 'How Decker, a free Figma-to-Google-Slides plugin, handles your data.',
      path: '/privacy',
      jsonLdType: 'WebPage',
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
        <p>Decker is a free plugin, provided “as is” without warranty of any kind, built as a personal project. You remain solely responsible for the content you export through the plugin.</p>
        <p>Using the plugin requires using your Google account via the OAuth authentication described in the <a class="text-link" href="${SITE_URL}/privacy">Privacy Policy</a>.</p>
        <p>Decker is free. If the plugin saves you time, a donation via <a class="text-link" href="${COFFEE_URL}" target="_blank" rel="${REL_THIRD_PARTY}">Buy me a coffee</a> is appreciated but never required.</p>
        <p>For any question, contact <a class="text-link" href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
      </section>
    </div>
  `;
  res.type('html').send(
    shell({
      title: 'Decker: Terms of Use',
      description: 'Terms of use for Decker, a free Figma-to-Google-Slides plugin.',
      path: '/terms',
      jsonLdType: 'WebPage',
      main,
    }),
  );
});

/**
 * Le PNG est servi par la fonction elle-même, décodé depuis le base64 de
 * `og/ogImageData.ts` : Vercel réécrit ici toutes les routes (voir
 * vercel.json), il n'y a pas de dossier statique devant. Le cache d'un an est
 * sûr parce que l'URL porte un numéro de version (OG_IMAGE_VERSION) : un
 * nouveau visuel = une nouvelle URL.
 */
pagesRouter.get(`/${OG_IMAGE.file}`, (_req, res) => {
  res
    .type('png')
    .set('Cache-Control', 'public, max-age=31536000, immutable')
    .send(Buffer.from(OG_IMAGE_PNG_BASE64, 'base64'));
});

/** Jeu de l'easter egg, chargé au clic. Versionné comme la vidéo : cache d'un an. */
const EASTER_EGG_JS = easterEggScript(PLUGIN_URL);
pagesRouter.get('/easter-egg.js', (_req, res) => {
  res
    .type('application/javascript')
    .set('Cache-Control', 'public, max-age=31536000, immutable')
    .send(EASTER_EGG_JS);
});

pagesRouter.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
});

pagesRouter.get('/sitemap.xml', (_req, res) => {
  const urls = ['/', '/privacy', '/terms'];
  const body = urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc></url>`).join('\n');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
});
