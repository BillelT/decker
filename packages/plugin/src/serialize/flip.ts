/**
 * Détecte un miroir ("Flip Horizontal"/"Flip Vertical" dans Figma) sur la
 * partie linéaire d'une `relativeTransform`. Logique pure (pas de
 * dépendance à l'API Figma) pour rester testable — `serializeFrame.ts`
 * adapte le SceneNode réel vers ces primitives.
 *
 * `node.rotation` (doc Figma : `atan2(-m10, m00)`) ne dépend que de la
 * 1re colonne de la matrice (m00, m10) — un miroir ne s'y lit jamais, il ne
 * change que l'orientation de la 2e colonne (m01, m11) relativement à la
 * 1re. Un miroir se traduit donc par un déterminant négatif
 * (`m00*m11 - m01*m10 < 0`), alors qu'une rotation seule a toujours un
 * déterminant de +1 (la doc Figma garantit des axes unitaires — pas de
 * scale caché dans cette matrice, seulement rotation et/ou réflexion).
 */
export function isFlippedTransform(m00: number, m01: number, m10: number, m11: number): boolean {
  return m00 * m11 - m01 * m10 < 0;
}
