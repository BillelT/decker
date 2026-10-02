import type { Notice } from './types.js';

/**
 * Pastille d'état (footer et toasts), reprise de la page de retour OAuth du site
 * (backend routes/auth.ts, `renderModernPage`) : rond orange de marque et
 * coche pour un succès, rond rouge et croix pour un échec. Mêmes tracés,
 * réduits à 16px. Un `rect` arrondi plutôt qu'un `circle` : les deux skins
 * l'équarrissent en CSS (`rx: 0`), comme les badges du rail.
 */
export function StatusIcon({ tone }: { tone: 'success' | 'error' }) {
  return (
    <svg className={`f2s-status-icon f2s-status-icon--${tone}`} width="16" height="16" viewBox="0 0 66 66" fill="none" aria-hidden="true">
      <rect className="f2s-status-icon-disc" width="66" height="66" rx="33" />
      {tone === 'success' ? (
        <path d="M20 34 L29 43 L46 24" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ) : (
        <path d="M24 24 L42 42 M42 24 L24 42" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
      )}
    </svg>
  );
}

/**
 * Toast temporaire en haut du panneau (voir `.f2s-toast`), partagé par
 * DeckPanel et TemplatePanel. `role="alert"` pour une erreur, qui doit être
 * annoncée tout de suite ; `status` pour un succès, qui peut attendre.
 */
export function Toast({ notice }: { notice: Notice }) {
  return (
    <div className={`f2s-toast f2s-toast--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
      <StatusIcon tone={notice.tone} />
      <span>{notice.message}</span>
    </div>
  );
}
