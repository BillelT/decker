import type { AffineTransform, Dimension } from './slidesRequests.js';

export const SLIDE_16_9 = { widthPt: 720, heightPt: 405 };

export interface FrameScale {
  scale: number;
  offsetXPt: number;
  offsetYPt: number;
}

/**
 * Spec §3.1 — facteur unique appliqué à TOUTES les dimensions d'une frame.
 * Ratio préservé : on prend le min pour que la frame tienne entièrement,
 * puis on centre (offsetX/offsetY) si les ratios diffèrent.
 */
export function computeScale(
  frame: { width: number; height: number },
  slide: { widthPt: number; heightPt: number } = SLIDE_16_9,
): FrameScale {
  const s = Math.min(slide.widthPt / frame.width, slide.heightPt / frame.height);
  return {
    scale: s,
    offsetXPt: (slide.widthPt - frame.width * s) / 2,
    offsetYPt: (slide.heightPt - frame.height * s) / 2,
  };
}

export const toPt = (px: number, scale: number): number => px * scale;

/**
 * Spec §3.1 RÈGLE — arrondi uniquement à la sérialisation finale (3 décimales).
 * Ne jamais arrondir en cours de chaîne.
 */
export function roundForSerialization(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function pt(magnitude: number): Dimension {
  return { magnitude: roundForSerialization(magnitude), unit: 'PT' };
}

/**
 * Spec §3.2 — transform canonique non tournée : coin haut-gauche, scale 1.
 */
export function identityTransform(xPt: number, yPt: number): AffineTransform {
  return {
    scaleX: 1,
    scaleY: 1,
    shearX: 0,
    shearY: 0,
    translateX: roundForSerialization(xPt),
    translateY: roundForSerialization(yPt),
    unit: 'PT',
  };
}

/**
 * Spec §3.2 — Slides applique la transform autour de l'origine haut-gauche,
 * pas du centre. On compose : translation vers le centre, rotation, puis
 * translation inverse. `degCCW` suit la convention Figma (antihoraire).
 */
export function rotatedTransform(
  xPt: number,
  yPt: number,
  wPt: number,
  hPt: number,
  degCCW: number,
): AffineTransform {
  if (degCCW === 0) return identityTransform(xPt, yPt);

  const t = (-degCCW * Math.PI) / 180; // Figma CCW → Slides CW
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const cx = xPt + wPt / 2;
  const cy = yPt + hPt / 2;
  return {
    scaleX: cos,
    scaleY: cos,
    shearX: -sin,
    shearY: sin,
    translateX: roundForSerialization(cx - cos * (wPt / 2) + sin * (hPt / 2)),
    translateY: roundForSerialization(cy - sin * (wPt / 2) - cos * (hPt / 2)),
    unit: 'PT',
  };
}

/**
 * Spec §3.5 RÈGLE — padding interne : compense le textInset mesuré en
 * Phase 0 en agrandissant la boîte et en la décalant vers le coin
 * haut-gauche, pour que le TEXTE rendu tombe exactement sur `rect`.
 */
export function applyTextInset(
  rect: { x: number; y: number; w: number; h: number },
  inset: { left: number; right: number; top: number; bottom: number },
): { x: number; y: number; w: number; h: number } {
  return {
    x: rect.x - inset.left,
    y: rect.y - inset.top,
    w: rect.w + inset.left + inset.right,
    h: rect.h + inset.top + inset.bottom,
  };
}
