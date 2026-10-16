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
  if (status === 413) return 'An image is too large to upload. Simplify it, then retry.';
  if (status === 429) return 'Too many requests. Wait a minute, then retry.';
  if (step === 'retry' && (status === 404 || status === 409)) return "Can't retry these anymore. Export again.";
  if (status === 403) return 'Access refused. Sign out in Settings, then sign back in.';
  if (status === 400 || status === 404 || status === 415 || status === 422) {
    return 'Request rejected. Reopen the plugin and retry.';
  }
  const service = step === 'sign-in' ? 'The sign-in service' : 'The export server';
  if (status === 502 || status === 503 || status === 504) return `${service} is unavailable right now. Retry shortly.`;
  if (status >= 500) return `${service} ran into a problem. Retry shortly.`;
  return `Request failed (error ${status}). Retry shortly.`;
}

/** `fetch` a échoué sans réponse : réseau coupé, serveur injoignable. */
export function describeNetworkFailure(step: RequestStep): string {
  const service = step === 'sign-in' ? 'the sign-in service' : 'the export server';
  return `Can't reach ${service}. Check your connection.`;
}

/** Le suivi d'un export lancé a été coupé : la présentation peut quand même aboutir côté serveur. */
export const POLL_INTERRUPTED_MESSAGE = 'Connection lost. The presentation may still appear in your Drive.';

/** Échec global d'un job (avant ou hors des slides : création de la présentation, du Master…). */
export function describeJobFailure(noun: 'slide' | 'layout'): string {
  const subject = noun === 'layout' ? 'The template' : 'The presentation';
  return `${subject} couldn't be created. Retry shortly.`;
}

/**
 * Échec d'une slide précise, à partir du message du backend
 * ("Slides API 400 on /presentations/…:batchUpdate: Invalid requests[3]…").
 * Seul le code HTTP de Google sert à choisir le conseil ; un message sans
 * code reconnaissable retombe sur le conseil général.
 */
export function describeSlideFailure(raw: string, noun: 'slide' | 'layout'): string {
  const advice = slideFailureAdvice(raw, noun);
  // La raison exacte donnée par Google ("Invalid requests[3].createShape:
  // …"), sans quoi un refus ne se diagnostique pas sans les logs serveur.
  const reason = /batchUpdate: ([\s\S]+)$/.exec(raw)?.[1]?.trim();
  if (!reason) return advice;
  const short = reason.length > 300 ? `${reason.slice(0, 300)}…` : reason;
  return `${advice} Google Slides said: "${short}"`;
}

function slideFailureAdvice(raw: string, noun: 'slide' | 'layout'): string {
  const status = Number(/Slides API (\d{3})/.exec(raw)?.[1] ?? NaN);
  if (status === 400 && /image/i.test(raw)) {
    return `Google Slides rejected an image on this ${noun}. Simplify it in Figma, then retry.`;
  }
  if (status === 400) return `Google Slides rejected an element on this ${noun}. Retry, or simplify it in Figma.`;
  if (status === 401 || status === 403) return 'Google refused access. Sign out in Settings, sign back in, then retry.';
  if (status === 429) return 'Google Slides is rate limiting. Wait a minute, then retry.';
  if (status >= 500) return `Google Slides had a temporary problem with this ${noun}. Retry it.`;
  return `This ${noun} couldn't be written to Google Slides. Retry, or simplify it.`;
}
