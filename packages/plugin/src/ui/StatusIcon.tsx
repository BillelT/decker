import type { Notice, NoticeTone } from './types.js';

/**
 * Pastille d'état (footer et toasts), reprise de la page de retour OAuth du site
 * (backend routes/auth.ts, `renderModernPage`) : rond orange de marque et
 * coche pour un succès, rond rouge et croix pour un échec. Mêmes tracés,
 * réduits à 16px. Un `rect` arrondi plutôt qu'un `circle` : les deux skins
 * l'équarrissent en CSS (`rx: 0`), comme les badges du rail. Une information
 * (ni succès ni échec) prend un rond à l'encre et un « i ».
 */
export function StatusIcon({ tone }: { tone: NoticeTone }) {
  return (
    <svg className={`f2s-status-icon f2s-status-icon--${tone}`} width="16" height="16" viewBox="0 0 66 66" fill="none" aria-hidden="true">
      <rect className="f2s-status-icon-disc" width="66" height="66" rx="33" />
      {tone === 'success' ? (
        <path d="M20 34 L29 43 L46 24" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      ) : tone === 'info' ? (
        <path d="M33 31 L33 46 M33 20 L33 20.01" stroke="currentColor" stroke-width="9" stroke-linecap="round" />
      ) : (
        <path d="M24 24 L42 42 M42 24 L24 42" stroke="currentColor" stroke-width="9" stroke-linecap="round" />
      )}
    </svg>
  );
}

/** Croix de fermeture (modale Settings, toasts). */
export function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="m3 3 8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  );
}

/**
 * Toast temporaire en haut du panneau (voir `.f2s-toast`), partagé par
 * DeckPanel et TemplatePanel. `role="alert"` pour une erreur, qui doit être
 * annoncée tout de suite ; `status` pour un succès ou une information, qui
 * peuvent attendre.
 *
 * Il se ferme seul : la barre du bas se vide sur `durationMs`, et c'est la
 * fin de SON animation qui le ferme. Survoler le toast ou y placer le focus
 * met l'animation en pause (CSS), donc le minuteur aussi, sans état à
 * synchroniser. La croix le ferme tout de suite.
 */
export function Toast({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  return (
    <div className={`f2s-toast f2s-toast--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
      <StatusIcon tone={notice.tone} />
      <span className="f2s-toast-text">{notice.message}</span>
      <button type="button" className="f2s-icon-btn f2s-toast-close" title="Dismiss" aria-label="Dismiss notification" onClick={onDismiss}>
        <CloseIcon />
      </button>
      <span className="f2s-toast-timer" style={{ animationDuration: `${notice.durationMs}ms` }} onAnimationEnd={onDismiss} aria-hidden="true" />
    </div>
  );
}
