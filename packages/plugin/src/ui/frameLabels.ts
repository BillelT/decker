/**
 * Libellés dérivés d'une frame, pour le rail du mode deck.
 */

/**
 * Préfixes posés par "Prepare for Slides" sur les copies qu'il crée (voir
 * `SLIDES_READY_PREFIX` / `TEMPLATE_READY_PREFIX` dans code.ts). Identiques
 * sur toutes les copies, ils n'aident pas à reconnaître une frame et
 * mangeraient la moitié des 150 px de nom du rail.
 */
const READY_PREFIXES = ['[Slides Ready] ', '[Template Ready] '];

/** Nom de la frame tel qu'affiché dans le rail : sans le préfixe de copie. Le nom Figma complet reste dans l'infobulle. */
export function displayFrameName(name: string): string {
  for (const prefix of READY_PREFIXES) {
    if (name.startsWith(prefix)) return name.slice(prefix.length);
  }
  return name;
}
