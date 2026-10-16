import type { IRColor, IRElement, IRPaint, PlaceholderRole } from '@figma-to-slides/shared';

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
  /** À quoi sert la couleur, pour "Suggest roles" (templateColorRoles.ts). */
  usage?: ColorUsage;
}

/**
 * Usage d'une couleur, par fonction plutôt que par luminosité : une palette
 * sombre a un texte clair, et seul l'usage dit lequel est le texte.
 * - `text` et `link` : nombre de caractères (un paragraphe pèse plus qu'un
 *   libellé) ;
 * - `frame` : nombre de layouts dont c'est le fond de frame (devenu le
 *   vrai fond de page Slides) ;
 * - `background` : aplats qui couvrent au moins `BACKGROUND_AREA_RATIO` de
 *   la frame (cartes, panneaux), pondérés par leur surface ;
 * - `fill` : les autres aplats (pastilles, boutons, puces), en nombre ;
 * - `stroke` : contours et lignes, en nombre.
 */
export interface ColorUsage {
  frame: number;
  text: number;
  link: number;
  background: number;
  fill: number;
  stroke: number;
}

/** Part de la frame à partir de laquelle un aplat compte comme un fond plutôt qu'un élément. */
export const BACKGROUND_AREA_RATIO = 0.25;

function emptyUsage(): ColorUsage {
  return { frame: 0, text: 0, link: 0, background: 0, fill: 0, stroke: 0 };
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

/**
 * Un élément de layout tel que listé dans la section "Content" du rapport
 * de template : ce qu'il faut pour l'afficher, le sélectionner dans Figma
 * et lui assigner (ou lui retirer) un rôle de placeholder.
 */
export interface TemplateElementSummary {
  id: string;
  sourceNodeId: string;
  name: string;
  kind: IRElement['kind'];
  /** Rôle actuellement tagué sur le calque, s'il y en a un. */
  role?: PlaceholderRole;
  label?: string;
  /** Pour un texte : de quoi deviner son rôle ("Suggest roles", templatePlaceholderRoles.ts). */
  text?: TextStats;
}

export interface TextStats {
  /** Plus grande taille de police du calque, en px Figma. */
  fontSizePx: number;
  chars: number;
  paragraphs: number;
  /** Haut du calque dans la frame : départage deux textes de même taille. */
  y: number;
  /** Chiffre clé affiché en grand ("87%", "120k", "$4.2M") : voir `isStatText`. */
  stat: boolean;
}

/**
 * Un chiffre clé ("87%", "120k", "$4.2M", "+35", "3x") : court, fait d'un
 * nombre et d'au plus une unité. Ni un titre ni un paragraphe : "Suggest
 * roles" le tague `[[custom]]`, sinon il prendrait le placeholder titre
 * natif, dont l'invite de 50 caractères déborderait à cette taille.
 */
export function isStatText(content: string): boolean {
  const text = content.trim();
  return text.length > 0 && text.length <= 10 && /^[+\-~≈<>]?\s?[$€£¥]?\s?\d[\d\s.,]*\s?(%|[kKMB]|bn|x|×|\+|pts?)?$/.test(text);
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

/**
 * Couleurs distinctes utilisées par la frame (fond, fills et contours de
 * forme, contours de ligne, texte), dans l'ordre d'apparition. Le fond et
 * la taille de la frame sont optionnels : sans eux, aucun usage "fond"
 * n'est compté.
 */
export function summarizeColors(
  elements: IRElement[],
  frame: { background?: IRPaint; frameSize?: { width: number; height: number } } = {},
): TemplateColorSwatch[] {
  const byKey = new Map<string, TemplateColorSwatch>();
  const frameArea = frame.frameSize ? frame.frameSize.width * frame.frameSize.height : 0;

  const record = (color: IRColor, use: keyof ColorUsage, weight: number) => {
    const hex = toHex(color);
    const key = colorKey(hex, color.a);
    const existing = byKey.get(key);
    const swatch = existing ?? { hex, alpha: color.a, usageCount: 0, variableName: color.variableName, usage: emptyUsage() };
    swatch.usageCount++;
    if (!swatch.variableName && color.variableName) swatch.variableName = color.variableName;
    swatch.usage![use] += weight;
    if (!existing) byKey.set(key, swatch);
  };

  if (frame.background) record(frame.background.color, 'frame', 1);

  for (const el of elements) {
    switch (el.kind) {
      case 'shape':
        if (el.fill) {
          const ratio = frameArea > 0 ? (el.rect.w * el.rect.h) / frameArea : 0;
          if (ratio >= BACKGROUND_AREA_RATIO) record(el.fill.color, 'background', Math.min(1, ratio));
          else record(el.fill.color, 'fill', 1);
        }
        if (el.stroke) record(el.stroke.color, 'stroke', 1);
        break;
      case 'line':
        record(el.stroke.color, 'stroke', 1);
        break;
      case 'text':
        for (const run of el.runs) record(run.color, run.link ? 'link' : 'text', Math.max(1, run.end - run.start));
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

/**
 * Éléments auxquels il est sensé d'assigner un rôle de placeholder : la
 * liste que l'UI affiche sous "Content" (TemplatePanel).
 *
 * Existe parce que le rapport de template ne savait proposer un rôle que
 * sur les calques qui produisaient, par hasard, un AVERTISSEMENT de
 * fidélité (police substituée, dégradé…) : un layout parfaitement propre
 * n'offrait donc aucun moyen de taguer quoi que ce soit depuis le plugin,
 * il fallait aller renommer le calque à la main dans Figma
 * (TODO.md § Mode template, point 9).
 *
 * Les lignes sont écartées (un trait de séparation n'est jamais un
 * placeholder et n'aurait fait que rallonger la liste), SAUF si l'une
 * porte déjà un tag : mieux vaut pouvoir le lui retirer depuis le panneau
 * que de le laisser invisible.
 */
export function summarizeTaggableElements(elements: IRElement[]): TemplateElementSummary[] {
  const result: TemplateElementSummary[] = [];
  for (const el of elements) {
    if (el.kind === 'line' && !el.placeholder) continue;
    result.push({
      id: el.id,
      sourceNodeId: el.sourceNodeId,
      name: el.sourceNodeName ?? el.placeholder?.label ?? el.kind,
      kind: el.kind,
      role: el.placeholder?.role,
      label: el.placeholder?.label,
      ...(el.kind === 'text'
        ? {
            text: {
              fontSizePx: el.runs.reduce((max, run) => Math.max(max, run.fontSizePx), 0),
              chars: el.content.trim().length,
              paragraphs: Math.max(1, el.content.split('\n').filter((line) => line.trim()).length),
              y: el.rect.y,
              stat: isStatText(el.content),
            },
          }
        : {}),
    });
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
        if (c.usage) {
          const usage = (existing.usage ??= emptyUsage());
          for (const use of Object.keys(usage) as (keyof ColorUsage)[]) usage[use] += c.usage[use];
        }
      } else {
        byKey.set(key, { ...c, usage: c.usage ? { ...c.usage } : undefined });
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
