/**
 * Éléments de marque partagés par les pages HTML rendues côté serveur
 * (auth.ts §callback, pages.ts §public) — hors du pipeline esbuild du
 * plugin (§esbuild.config.mjs), donc recopiés ici en dur plutôt
 * qu'importés depuis packages/plugin.
 */

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

/** Pile de cartes façon icône du plugin. */
export const DECKER_MARK_SVG = `<svg viewBox="0 0 32 32" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
<rect x="3" y="15" width="20" height="14" fill="#7a3b12" stroke="#1a0d02" stroke-width="1"/>
<rect x="6" y="10" width="20" height="14" fill="#c1651c" stroke="#1a0d02" stroke-width="1"/>
<rect x="9" y="5" width="20" height="14" fill="#ffb238" stroke="#1a0d02" stroke-width="1"/>
<rect x="9" y="5" width="20" height="1" fill="#fff4d6"/>
<rect x="9" y="5" width="1" height="14" fill="#fff4d6"/>
<rect x="10.5" y="6.5" width="17" height="3.2" fill="#1a0d02"/>
<rect x="10.5" y="12" width="17" height="2" fill="#fff4d6"/>
<rect x="10.5" y="15" width="11" height="2" fill="#fff4d6"/>
<path d="M26 5 L29 5 L29 8 Z" fill="#1a0d02"/>
<path d="M26 5 L28 5 L28 7 Z" fill="#fff4d6"/>
</svg>`;

export const DECKER_FAVICON = `data:image/svg+xml,${encodeURIComponent(DECKER_MARK_SVG)}`;

/** Monogramme "B" personnel — recopié depuis assets/logo.svg. */
export const PERSONAL_MARK_SVG = `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="80" height="80" rx="40" fill="#F06800"/>
<path d="M48.6887 47.1716C50.2508 48.7337 50.2508 51.2664 48.6887 52.8285L44.2034 57.3138C41.6836 59.8336 37.375 58.049 37.375 54.4854L37.375 45.5148C37.375 41.9512 41.6836 40.1665 44.2034 42.6864L48.6887 47.1716Z" fill="#F2ECE8"/>
<path d="M48.6887 27.1715C50.2508 28.7335 50.2508 31.2662 48.6887 32.8283L44.2034 37.3136C41.6836 39.8334 37.375 38.0488 37.375 34.4852L37.375 25.5146C37.375 21.951 41.6836 20.1663 44.2034 22.6862L48.6887 27.1715Z" fill="#F2ECE8"/>
<rect x="30.6235" y="21.0001" width="3" height="37" rx="1.5" fill="#F2ECE8"/>
</svg>`;

/** Logo X (Twitter). */
export const X_MARK_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor"/>
</svg>`;

/** Tasse simple — pas le logo Buy Me a Coffee (marque déposée), juste une icône générique de don. */
export const COFFEE_MARK_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M8 3.5c-.6.7-.6 1.3 0 2s.6 1.3 0 2M12 3.5c-.6.7-.6 1.3 0 2s.6 1.3 0 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;
