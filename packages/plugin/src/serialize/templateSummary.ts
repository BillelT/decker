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
  /**
   * Police d'origine Figma si `family` vient d'une substitution (absent
   * pour une police nativement disponible dans Slides). Permet à l'UI
   * (TemplateStylePanel) de recalculer `family` à l'affichage à partir du
   * choix courant du sélecteur "Fonts" (`fontOverrides`) plutôt que de
   * rester figée sur la résolution par défaut du moment du serialize.
   */
  original?: string;
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

/**
 * Familles de police distinctes utilisées, avec l'ensemble des graisses
 * employées pour chacune. Groupé par police D'ORIGINE quand la police a été
 * substituée (`run.originalFontFamily`), pas par la police résolue par
 * défaut : deux polices manquantes différentes retombant toutes deux sur
 * "Inter" par défaut restent deux entrées distinctes, chacune capable de
 * suivre son propre choix dans le sélecteur "Fonts" (même granularité que
 * `collectFontSubstitutions` côté deck).
 */
export function summarizeFonts(elements: IRElement[]): TemplateFontUsage[] {
  const byKey = new Map<string, { family: string; weights: Set<number>; original?: string }>();

  for (const el of elements) {
    if (el.kind !== 'text') continue;
    for (const run of el.runs) {
      const key = run.originalFontFamily ?? run.fontFamily;
      const entry = byKey.get(key) ?? { family: run.fontFamily, weights: new Set<number>(), original: run.originalFontFamily };
      entry.weights.add(run.fontWeight);
      byKey.set(key, entry);
    }
  }

  return [...byKey.values()].map(({ family, weights, original }) => ({ family, weights: [...weights].sort((a, b) => a - b), original }));
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
      } else {
        byKey.set(key, { ...c });
      }
    }
  }
  return [...byKey.values()];
}

/** Même principe que `aggregateColorSwatches`, pour les polices — même clé de regroupement que `summarizeFonts` (police d'origine si substituée). */
export function aggregateFontUsages(perLayoutFonts: TemplateFontUsage[][]): TemplateFontUsage[] {
  const byKey = new Map<string, { family: string; weights: Set<number>; original?: string }>();
  for (const fonts of perLayoutFonts) {
    for (const f of fonts) {
      const key = f.original ?? f.family;
      const entry = byKey.get(key) ?? { family: f.family, weights: new Set<number>(), original: f.original };
      for (const w of f.weights) entry.weights.add(w);
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()].map(({ family, weights, original }) => ({ family, weights: [...weights].sort((a, b) => a - b), original }));
}
