import type { IRColor, IRElement, PlaceholderRole } from '@figma-to-slides/shared';

/**
 * brief-creation-template-google-slides.md — "focus d'abord sur le
 * fonctionnement, le contenu communicable de Figma vers Slides (couleurs,
 * typos, layouts...)" : ces trois fonctions n'opèrent que sur l'IR déjà
 * sérialisé (aucun accès à l'API Figma), pour rester testables comme le
 * reste de `serialize/` et réutilisables telles quelles côté rapport de
 * template dans l'UI.
 */

export interface TemplateColorSwatch {
  hex: string;
  alpha: number;
  usageCount: number;
  /** Nom de la variable Figma liée à cette couleur, si au moins une occurrence en référence une (`IRColor.variableName`) — affiché à la place du hex dans l'onglet Style. */
  variableName?: string;
}

export interface TemplateFontUsage {
  family: string;
  weights: number[];
}

export interface TemplatePlaceholderSummary {
  id: string;
  sourceNodeId: string;
  role: PlaceholderRole;
  label: string;
}

export function toHex(color: IRColor): string {
  const channel = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

/**
 * Identifiant stable d'une couleur (hex + alpha) — même format utilisé pour
 * dédupliquer les couleurs ci-dessous ET pour référencer une couleur depuis
 * l'assignation de rôle de thème (`templateTheme.ts`, onglet "Style" —
 * audit 2026-08, mode template, point 2).
 */
export function colorKey(hex: string, alpha: number): string {
  return `${hex}:${alpha.toFixed(2)}`;
}

/** Couleurs distinctes utilisées par la frame (fills et contours de forme, contours de ligne, texte), dans l'ordre d'apparition. */
export function summarizeColors(elements: IRElement[]): TemplateColorSwatch[] {
  const byKey = new Map<string, TemplateColorSwatch>();

  const record = (color: IRColor) => {
    const hex = toHex(color);
    const key = colorKey(hex, color.a);
    const existing = byKey.get(key);
    if (existing) {
      existing.usageCount++;
      if (!existing.variableName && color.variableName) existing.variableName = color.variableName;
    } else {
      byKey.set(key, { hex, alpha: color.a, usageCount: 1, variableName: color.variableName });
    }
  };

  for (const el of elements) {
    switch (el.kind) {
      case 'shape':
        if (el.fill) record(el.fill.color);
        if (el.stroke) record(el.stroke.color);
        break;
      case 'line':
        record(el.stroke.color);
        break;
      case 'text':
        for (const run of el.runs) record(run.color);
        break;
      case 'image':
        break;
    }
  }

  return [...byKey.values()];
}

/** Familles de police distinctes utilisées, avec l'ensemble des graisses employées pour chacune. */
export function summarizeFonts(elements: IRElement[]): TemplateFontUsage[] {
  const byFamily = new Map<string, Set<number>>();

  for (const el of elements) {
    if (el.kind !== 'text') continue;
    for (const run of el.runs) {
      const weights = byFamily.get(run.fontFamily) ?? new Set<number>();
      weights.add(run.fontWeight);
      byFamily.set(run.fontFamily, weights);
    }
  }

  return [...byFamily.entries()].map(([family, weights]) => ({ family, weights: [...weights].sort((a, b) => a - b) }));
}

/** Éléments tagués comme placeholder (convention `[[role]]`, cf. placeholder.ts), dans l'ordre d'apparition dans l'arbre aplati. */
export function summarizePlaceholders(elements: IRElement[]): TemplatePlaceholderSummary[] {
  const result: TemplatePlaceholderSummary[] = [];
  for (const el of elements) {
    if (!el.placeholder) continue;
    result.push({ id: el.id, sourceNodeId: el.sourceNodeId, role: el.placeholder.role, label: el.placeholder.label });
  }
  return result;
}

/**
 * Fusionne les rapports par layout (`summarizeColors`) en une seule vue
 * pour TOUT le template (onglet "Style" — audit 2026-08, mode template,
 * point 2) : le rapport par layout existant ne montrait qu'un layout à la
 * fois, alors que l'assignation de rôle de thème (Primary/Accent 1…) doit
 * porter sur les couleurs de TOUT le template, pas frame par frame.
 */
export function aggregateColorSwatches(perLayoutColors: TemplateColorSwatch[][]): TemplateColorSwatch[] {
  const byKey = new Map<string, TemplateColorSwatch>();
  for (const colors of perLayoutColors) {
    for (const c of colors) {
      const key = colorKey(c.hex, c.alpha);
      const existing = byKey.get(key);
      if (existing) {
        existing.usageCount += c.usageCount;
        if (!existing.variableName && c.variableName) existing.variableName = c.variableName;
      } else {
        byKey.set(key, { ...c });
      }
    }
  }
  return [...byKey.values()];
}

/** Même principe que `aggregateColorSwatches`, pour les polices. */
export function aggregateFontUsages(perLayoutFonts: TemplateFontUsage[][]): TemplateFontUsage[] {
  const byFamily = new Map<string, Set<number>>();
  for (const fonts of perLayoutFonts) {
    for (const f of fonts) {
      const weights = byFamily.get(f.family) ?? new Set<number>();
      for (const w of f.weights) weights.add(w);
      byFamily.set(f.family, weights);
    }
  }
  return [...byFamily.entries()].map(([family, weights]) => ({ family, weights: [...weights].sort((a, b) => a - b) }));
}
