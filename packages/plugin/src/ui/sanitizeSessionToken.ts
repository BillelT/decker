/**
 * Tolère un copier-coller imparfait du jeton de session renvoyé par
 * `/auth/callback` : `{"sessionToken":"xxx"}` en entier (au lieu de la
 * seule valeur), guillemets ou espaces superflus.
 */
export function sanitizeSessionToken(raw: string): string {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed.sessionToken === 'string') return parsed.sessionToken;
  } catch {
    // pas du JSON, on continue avec la valeur brute
  }
  return trimmed.replace(/^["']|["']$/g, '');
}
