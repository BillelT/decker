import type { IRColor } from '@figma-to-slides/shared';
import type { OpaqueColor, SolidFill } from './slidesRequests.js';

/**
 * Spec §3.6 — Slides `rgbColor` en 0..1, alpha séparé. Si `themeRole` est
 * renseigné (audit 2026-08, mode template), lie l'élément à ce slot du
 * thème plutôt qu'à un `rgbColor` figé — voir `mapper/theme.ts` pour
 * l'écriture des couleurs correspondantes sur le Master.
 */
export function toOpaqueColor(c: Pick<IRColor, 'r' | 'g' | 'b' | 'themeRole'>): OpaqueColor {
  if (c.themeRole) return { themeColor: c.themeRole };
  return { rgbColor: { red: clamp01(c.r), green: clamp01(c.g), blue: clamp01(c.b) } };
}

export function toSolidFill(c: IRColor): SolidFill {
  return { color: toOpaqueColor(c), alpha: clamp01(c.a) };
}

/**
 * Spec §3.6 RÈGLE — l'opacité du nœud ET celle du fill se multiplient ;
 * une seule valeur `alpha` existe côté Slides, on envoie le produit.
 */
export function combinedAlpha(fillOpacity = 1, nodeOpacity = 1): number {
  return clamp01(fillOpacity * nodeOpacity);
}

export function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.min(1, Math.max(0, v));
}
