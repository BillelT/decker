/**
 * Spec §3.3 — "strokes multiples ou strokeAlign != 'CENTER' avec écart >
 * 0.5pt". Logique pure (pas de dépendance à l'API Figma) pour rester
 * testable : `serializeFrame.ts` adapte le SceneNode réel vers ces
 * primitives.
 */
export const STROKE_OFFCENTER_TOLERANCE_PT = 0.5;

export function shouldRasterForStroke(input: {
  visibleStrokeCount: number;
  weightIsMixed: boolean;
  weight: number;
  align: 'CENTER' | 'INSIDE' | 'OUTSIDE';
}): boolean {
  if (input.visibleStrokeCount === 0) return false;
  if (input.visibleStrokeCount > 1) return true;
  if (input.weightIsMixed) return true;
  if (input.align === 'CENTER') return false;

  const deviation = input.weight / 2;
  return deviation > STROKE_OFFCENTER_TOLERANCE_PT;
}
