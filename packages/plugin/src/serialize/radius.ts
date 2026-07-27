/**
 * Spec §3.3 RÈGLE RADIUS — Slides ne permet pas de fixer le rayon d'un
 * ROUND_RECTANGLE ; on décide entre RECTANGLE / ELLIPSE / ROUND_RECTANGLE /
 * raster selon le rapport rayon / min(w,h).
 */
export const RADIUS_NATIVE_TOLERANCE = { min: 0.08, max: 0.25 };

export type RadiusDecision =
  | { kind: 'rectangle' }
  | { kind: 'ellipse' }
  | { kind: 'round-rectangle'; approximated: boolean }
  | { kind: 'raster'; reason: string };

export interface CornerRadii {
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
}

export function decideRadius(radii: CornerRadii, w: number, h: number, tolerance = RADIUS_NATIVE_TOLERANCE): RadiusDecision {
  const { topLeft, topRight, bottomLeft, bottomRight } = radii;
  const allZero = topLeft === 0 && topRight === 0 && bottomLeft === 0 && bottomRight === 0;
  if (allZero) return { kind: 'rectangle' };

  const uniform = topLeft === topRight && topRight === bottomLeft && bottomLeft === bottomRight;
  if (!uniform) return { kind: 'raster', reason: 'Rayons de coin non uniformes — non représentable nativement.' };

  const minDim = Math.min(w, h);
  if (topLeft >= minDim / 2) {
    return w === h ? { kind: 'ellipse' } : { kind: 'round-rectangle', approximated: true };
  }

  const ratio = topLeft / minDim;
  if (ratio >= tolerance.min && ratio <= tolerance.max) {
    return { kind: 'round-rectangle', approximated: true };
  }

  return { kind: 'raster', reason: `Rapport rayon/min(w,h) = ${ratio.toFixed(3)}, hors tolérance [${tolerance.min}; ${tolerance.max}].` };
}
