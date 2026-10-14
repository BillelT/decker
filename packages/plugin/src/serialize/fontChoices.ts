import type { IRElement } from '@figma-to-slides/shared';

/** Une police du deck pour le bandeau « Fonts » : sa famille dans Figma, celle utilisée par défaut dans Slides, et si Slides l'a telle quelle. */
export interface FontChoice {
  original: string;
  resolved: string;
  available: boolean;
}

/**
 * Polices de la frame pour le bandeau « Fonts » de l'UI, une entrée par
 * famille d'origine, dans l'ordre d'apparition : toutes, pas seulement
 * celles que Slides n'a pas. Une police disponible dans Slides (une Google
 * Font, par exemple) se remplace ainsi en un clic dans toute la
 * présentation, au même titre qu'une police substituée.
 */
export function collectFontSubstitutions(slide: { elements: IRElement[] }): FontChoice[] {
  const seen = new Set<string>();
  const fonts: FontChoice[] = [];
  for (const el of slide.elements) {
    if (el.kind !== 'text') continue;
    for (const run of el.runs) {
      const original = run.originalFontFamily ?? run.fontFamily;
      if (seen.has(original)) continue;
      seen.add(original);
      fonts.push({ original, resolved: run.fontFamily, available: run.originalFontFamily === undefined });
    }
  }
  return fonts;
}

/**
 * Copie de la slide avec le choix de police fait dans le bandeau « Fonts »,
 * par famille d'origine. Une copie, plus une mutation : le choix modifiait
 * la slide en attente elle-même, si bien qu'après un export la police
 * choisie passait pour la police d'origine. Une police disponible remplacée
 * par choix devient une substitution comme une autre (`originalFontFamily`
 * posé) : le backend lui ajoute la même marge de largeur qu'aux polices
 * substituées, ses métriques n'étant plus celles de Figma (mapper/text.ts).
 */
export function withFontOverrides<T extends { elements: IRElement[] }>(slide: T, overrides: Record<string, string>): T {
  if (Object.keys(overrides).length === 0) return slide;
  return {
    ...slide,
    elements: slide.elements.map((el) => {
      if (el.kind !== 'text') return el;
      return {
        ...el,
        runs: el.runs.map((run) => {
          const original = run.originalFontFamily ?? run.fontFamily;
          const override = overrides[original];
          if (!override || override === run.fontFamily) return run;
          return { ...run, fontFamily: override, originalFontFamily: original };
        }),
      };
    }),
  };
}
