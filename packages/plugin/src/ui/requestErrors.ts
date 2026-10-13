/**
 * Messages d'erreur montrés à l'utilisateur quand le backend ou Google Slides
 * refuse une requête. Avant, le plugin affichait le texte brut
 * ("Asset upload rejected (413)", "internal_error (500)", "Slides API 400 on
 * /presentations/…") : un code que personne ne sait lire. Chaque message dit
 * maintenant ce qui s'est passé et quoi faire ; le détail technique part dans
 * la console, pour le débogage.
 */

/** Étape du parcours qui a échoué : le conseil n'est pas le même pour une connexion et pour un export. */
export type RequestStep = 'upload' | 'export' | 'retry' | 'sign-in';

/** Réponse HTTP non-OK du backend (hors 401, traité à part comme session expirée). */
export function describeHttpFailure(step: RequestStep, status: number): string {
  if (status === 413) return 'An image is too large to upload. Reduce the size of the rasterized elements, then try again.';
  if (status === 429) return 'Too many requests in a short time. Wait a minute, then try again.';
  if (step === 'retry' && (status === 404 || status === 409)) return "These items can't be retried anymore. Export again to create a new presentation.";
  if (status === 403) return 'Access was refused. Sign out from Settings, sign back in, then try again.';
  if (status === 400 || status === 404 || status === 415 || status === 422) {
    return 'The request was rejected as incomplete. Close and reopen the plugin, then try again.';
  }
  const service = step === 'sign-in' ? 'The sign-in service' : 'The export server';
  if (status === 502 || status === 503 || status === 504) return `${service} is unavailable right now. Try again in a moment.`;
  if (status >= 500) return `${service} ran into a problem. Try again in a moment.`;
  return `The request failed (error ${status}). Try again in a moment.`;
}

/** `fetch` a échoué sans réponse : réseau coupé, serveur injoignable. */
export function describeNetworkFailure(step: RequestStep): string {
  const service = step === 'sign-in' ? 'the sign-in service' : 'the export server';
  return `Can't reach ${service}. Check your internet connection, then try again.`;
}

/** Le suivi d'un export lancé a été coupé : la présentation peut quand même aboutir côté serveur. */
export const POLL_INTERRUPTED_MESSAGE = 'The connection was interrupted during the export. The presentation may still finish: check your Google Drive, or try again.';

/** Échec global d'un job (avant ou hors des slides : création de la présentation, du Master…). */
export function describeJobFailure(noun: 'slide' | 'layout'): string {
  const subject = noun === 'layout' ? 'The template' : 'The presentation';
  return `${subject} couldn't be created in Google Slides. Try again in a moment.`;
}

/**
 * Échec d'une slide précise, à partir du message du backend
 * ("Slides API 400 on /presentations/…:batchUpdate: Invalid requests[3]…").
 * Seul le code HTTP de Google sert à choisir le conseil ; un message sans
 * code reconnaissable retombe sur le conseil général.
 */
export function describeSlideFailure(raw: string, noun: 'slide' | 'layout'): string {
  const status = Number(/Slides API (\d{3})/.exec(raw)?.[1] ?? NaN);
  if (status === 400 && /image/i.test(raw)) {
    return `Google Slides rejected an image on this ${noun}, too large or in a format it can't read. Simplify the rasterized elements in Figma, then retry.`;
  }
  if (status === 400) return `Google Slides rejected an element on this ${noun}. Retry; if it keeps failing, simplify the ${noun} in Figma (fewer effects or layers).`;
  if (status === 401 || status === 403) return 'Google refused access to the presentation. Sign out from Settings, sign back in, then retry.';
  if (status === 429) return 'Google Slides is limiting requests right now. Wait a minute, then retry.';
  if (status >= 500) return `Google Slides had a temporary problem with this ${noun}. Retry it.`;
  return `This ${noun} couldn't be written to Google Slides. Retry; if it keeps failing, simplify it in Figma.`;
}
