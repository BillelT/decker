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

function toHex(color: IRColor): string {
  const channel = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

/** Couleurs distinctes utilisées par la frame (fills et contours de forme, contours de ligne, texte), dans l'ordre d'apparition. */
export function summarizeColors(elements: IRElement[]): TemplateColorSwatch[] {
  const byKey = new Map<string, TemplateColorSwatch>();

  const record = (color: IRColor) => {
    const hex = toHex(color);
    const key = `${hex}:${color.a.toFixed(2)}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.usageCount++;
    } else {
      byKey.set(key, { hex, alpha: color.a, usageCount: 1 });
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
