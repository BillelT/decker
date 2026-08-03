import { PNG } from 'pngjs';

/**
 * Primitives de remplissage vectoriel pour les images de référence des
 * fixtures géométriques (rotation, formes) — `pngjs` ne sait dessiner que
 * des pixels, pas des formes ; ces fonctions sont le strict minimum pour
 * peindre un polygone convexe ou une ellipse en aplat uni, sans anti-
 * aliasing (comme `rects.ts::fillRect`, suffisant pour un SSIM ≥ 0.99 sur
 * `01-rects` — les bords durs d'un aplat de référence tolèrent très bien le
 * léger anti-aliasing du rendu Slides réel).
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function setPixel(png: PNG, x: number, y: number, color: RgbColor): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = Math.round(color.r * 255);
  png.data[idx + 1] = Math.round(color.g * 255);
  png.data[idx + 2] = Math.round(color.b * 255);
  png.data[idx + 3] = 255;
}

/** Ray casting standard — fonctionne pour tout polygone simple, convexe ou non. */
function pointInPolygon(px: number, py: number, points: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function fillPolygon(png: PNG, points: [number, number][], color: RgbColor): void {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(png.width - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(png.height - 1, Math.ceil(Math.max(...ys)));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInPolygon(x + 0.5, y + 0.5, points)) setPixel(png, x, y, color);
    }
  }
}

export function fillRect(png: PNG, x: number, y: number, w: number, h: number, color: RgbColor): void {
  const minX = Math.max(0, Math.round(x));
  const maxX = Math.min(png.width - 1, Math.round(x + w) - 1);
  const minY = Math.max(0, Math.round(y));
  const maxY = Math.min(png.height - 1, Math.round(y + h) - 1);
  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) setPixel(png, px, py, color);
  }
}

/**
 * Rectangle à coins arrondis — `radius` est une approximation (voir
 * LIMITATIONS.md : `roundRectRadiusRatio` n'est pas mesuré, Slides impose de
 * toute façon son propre rayon fixe non paramétrable pour ROUND_RECTANGLE).
 * Un coin est exclu du remplissage s'il tombe hors du quart de cercle de
 * rayon `radius` centré sur le coin intérieur correspondant.
 */
export function fillRoundedRect(png: PNG, x: number, y: number, w: number, h: number, radius: number, color: RgbColor): void {
  const r = Math.min(radius, w / 2, h / 2);
  const minX = Math.max(0, Math.round(x));
  const maxX = Math.min(png.width - 1, Math.round(x + w) - 1);
  const minY = Math.max(0, Math.round(y));
  const maxY = Math.min(png.height - 1, Math.round(y + h) - 1);
  const centers = [
    { cx: x + r, cy: y + r, cornerX: (px: number) => px < x + r, cornerY: (py: number) => py < y + r },
    { cx: x + w - r, cy: y + r, cornerX: (px: number) => px > x + w - r, cornerY: (py: number) => py < y + r },
    { cx: x + r, cy: y + h - r, cornerX: (px: number) => px < x + r, cornerY: (py: number) => py > y + h - r },
    { cx: x + w - r, cy: y + h - r, cornerX: (px: number) => px > x + w - r, cornerY: (py: number) => py > y + h - r },
  ];
  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const corner = centers.find((c) => c.cornerX(px + 0.5) && c.cornerY(py + 0.5));
      if (corner) {
        const dx = px + 0.5 - corner.cx;
        const dy = py + 0.5 - corner.cy;
        if (dx * dx + dy * dy > r * r) continue;
      }
      setPixel(png, px, py, color);
    }
  }
}

/** Ellipse inscrite dans le rectangle [x, x+w] × [y, y+h]. */
export function fillEllipse(png: PNG, x: number, y: number, w: number, h: number, color: RgbColor): void {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const minX = Math.max(0, Math.floor(x));
  const maxX = Math.min(png.width - 1, Math.ceil(x + w));
  const minY = Math.max(0, Math.floor(y));
  const maxY = Math.min(png.height - 1, Math.ceil(y + h));
  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const nx = (px + 0.5 - cx) / rx;
      const ny = (py + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) setPixel(png, px, py, color);
    }
  }
}

/** Anneau rectangulaire (contour) d'épaisseur `weight`, centré sur le bord du rectangle [x,x+w]×[y,y+h]. */
export function strokeRect(png: PNG, x: number, y: number, w: number, h: number, weight: number, color: RgbColor): void {
  const outer = { x: x - weight / 2, y: y - weight / 2, w: w + weight, h: h + weight };
  const inner = { x: x + weight / 2, y: y + weight / 2, w: w - weight, h: h - weight };
  const minX = Math.max(0, Math.floor(outer.x));
  const maxX = Math.min(png.width - 1, Math.ceil(outer.x + outer.w));
  const minY = Math.max(0, Math.floor(outer.y));
  const maxY = Math.min(png.height - 1, Math.ceil(outer.y + outer.h));
  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const inOuter = px + 0.5 >= outer.x && px + 0.5 <= outer.x + outer.w && py + 0.5 >= outer.y && py + 0.5 <= outer.y + outer.h;
      const inInner = px + 0.5 >= inner.x && px + 0.5 <= inner.x + inner.w && py + 0.5 >= inner.y && py + 0.5 <= inner.y + inner.h;
      if (inOuter && !inInner) setPixel(png, px, py, color);
    }
  }
}
