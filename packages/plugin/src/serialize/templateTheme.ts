import type { IRElement, IRColor, IRShape, IRText, IRLine, ThemeColorRole } from '@figma-to-slides/shared';
import { colorKey, toHex, type TemplateColorSwatch } from './templateSummary.js';

/**
 * Onglet "Style" du mode template (audit 2026-08, point 2 — voir
 * TODO.md § Mode template). Palette de repli utilisée pour tout rôle du
 * thème que le créateur n'a assigné à aucune couleur détectée : l'API
 * Slides exige les 12 `ThemeColorType` d'un coup pour toute écriture de
 * `colorScheme` (voir `mapper/theme.ts`), donc un rôle non assigné doit
 * quand même recevoir une valeur plutôt que de faire échouer l'écriture.
 * Approximation neutre du thème "Simple Light" par défaut de Slides — un
 * rôle réellement utilisé par un élément du template sera de toute façon
 * assigné explicitement par le créateur, donc jamais rendu avec ce repli.
 */
export const DEFAULT_THEME_ROLE_COLORS: Record<ThemeColorRole, { r: number; g: number; b: number }> = {
  DARK1: { r: 0, g: 0, b: 0 },
  LIGHT1: { r: 1, g: 1, b: 1 },
  DARK2: { r: 0.26, g: 0.26, b: 0.26 },
  LIGHT2: { r: 0.94, g: 0.94, b: 0.94 },
  ACCENT1: { r: 0.26, g: 0.52, b: 0.96 },
  ACCENT2: { r: 0.86, g: 0.2, b: 0.18 },
  ACCENT3: { r: 0.98, g: 0.74, b: 0.02 },
  ACCENT4: { r: 0.06, g: 0.62, b: 0.35 },
  ACCENT5: { r: 1, g: 0.6, b: 0 },
  ACCENT6: { r: 0.4, g: 0.4, b: 0.4 },
  HYPERLINK: { r: 0.06, g: 0.4, b: 0.84 },
  FOLLOWED_HYPERLINK: { r: 0.4, g: 0.24, b: 0.6 },
};

/** Ordre d'affichage des 12 rôles dans l'onglet Style — même liste que celle exigée par l'API (mapper/theme.ts::ALL_THEME_ROLES). */
export const THEME_ROLES: ThemeColorRole[] = [
  'DARK1',
  'LIGHT1',
  'DARK2',
  'LIGHT2',
  'ACCENT1',
  'ACCENT2',
  'ACCENT3',
  'ACCENT4',
  'ACCENT5',
  'ACCENT6',
  'HYPERLINK',
  'FOLLOWED_HYPERLINK',
];

/** Mêmes libellés que le sélecteur de couleurs de thème natif de Slides (Format > Thème > Couleurs) — pas les noms internes `ThemeColorType` de l'API. */
export const THEME_ROLE_LABELS: Record<ThemeColorRole, string> = {
  DARK1: 'Text & background 1',
  LIGHT1: 'Text & background 2',
  DARK2: 'Text & background 3',
  LIGHT2: 'Text & background 4',
  ACCENT1: 'Accent 1',
  ACCENT2: 'Accent 2',
  ACCENT3: 'Accent 3',
  ACCENT4: 'Accent 4',
  ACCENT5: 'Accent 5',
  ACCENT6: 'Accent 6',
  HYPERLINK: 'Link',
  FOLLOWED_HYPERLINK: 'Followed hyperlink',
};

/**
 * Rôles proposés dans l'aside Styles : Slides expose 11 des 12
 * `ThemeColorType` dans son propre sélecteur (Format > Thème > Couleurs) —
 * `FOLLOWED_HYPERLINK` n'y est jamais éditable séparément (dérivé
 * automatiquement). On masque donc cette ligne côté UI tout en la gardant
 * dans `THEME_ROLES`/`DEFAULT_THEME_ROLE_COLORS` : l'API l'exige quand même
 * dans l'écriture du thème (mapper/theme.ts::ALL_THEME_ROLES), elle reçoit
 * juste toujours sa valeur de repli plutôt qu'une assignation manuelle.
 */
export const VISIBLE_THEME_ROLES: ThemeColorRole[] = THEME_ROLES.filter((role) => role !== 'FOLLOWED_HYPERLINK');

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const channel = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Valeur hex de repli des 12 rôles (voir `DEFAULT_THEME_ROLE_COLORS`) — ce que l'onglet Style propose par défaut avant toute assignation. */
export const DEFAULT_THEME_ROLE_HEX: Record<ThemeColorRole, string> = THEME_ROLES.reduce(
  (acc, role) => ({ ...acc, [role]: rgbToHex(DEFAULT_THEME_ROLE_COLORS[role]) }),
  {} as Record<ThemeColorRole, string>,
);

/**
 * Hex effectif de chacun des 12 rôles, dans l'ordre de priorité :
 * 1. `roleColorOverrides[role]` — hex tapé à la main dans l'onglet Style ;
 * 2. la couleur détectée assignée à ce rôle via `colorRoles` (clic sur une
 *    suggestion) ;
 * 3. `DEFAULT_THEME_ROLE_HEX[role]`.
 * Utilisé à la fois par l'UI (aperçu des pastilles/champs hex) et par
 * `buildTemplateTheme` ci-dessous, pour ne jamais faire diverger les deux.
 */
export function resolveThemeRoleHexes(
  colorRoles: Record<string, ThemeColorRole>,
  colors: TemplateColorSwatch[],
  roleColorOverrides: Partial<Record<ThemeColorRole, string>> = {},
): Record<ThemeColorRole, string> {
  const byKey = new Map(colors.map((c) => [colorKey(c.hex, c.alpha), c]));
  const assignedHexByRole = new Map<ThemeColorRole, string>();
  for (const [key, role] of Object.entries(colorRoles)) {
    const swatch = byKey.get(key);
    if (swatch) assignedHexByRole.set(role, swatch.hex);
  }
  return THEME_ROLES.reduce(
    (acc, role) => ({ ...acc, [role]: roleColorOverrides[role] ?? assignedHexByRole.get(role) ?? DEFAULT_THEME_ROLE_HEX[role] }),
    {} as Record<ThemeColorRole, string>,
  );
}

/**
 * Construit la palette à écrire sur le Master (`IRDocument.theme`) à
 * partir des rôles assignés dans l'onglet Style. `colorRoles` associe une
 * clé de couleur (`colorKey`, cf. templateSummary.ts) à l'un des 12 rôles.
 * Renvoie `undefined` si aucun rôle n'a été assigné : pas d'écriture de
 * thème pour un template dont le créateur n'a pas touché l'onglet Style.
 */
export function buildTemplateTheme(
  colorRoles: Record<string, ThemeColorRole>,
  colors: TemplateColorSwatch[],
  roleColorOverrides: Partial<Record<ThemeColorRole, string>> = {},
): Record<ThemeColorRole, { r: number; g: number; b: number }> | undefined {
  if (Object.keys(colorRoles).length === 0 && Object.keys(roleColorOverrides).length === 0) return undefined;

  // Repli direct sur DEFAULT_THEME_ROLE_COLORS (pas un aller-retour par le
  // hex, cf. resolveThemeRoleHexes) pour un rôle non touché : évite une
  // dérive d'arrondi (0.86 -> "#DB" -> 0.8588…) sur une valeur que le
  // créateur n'a jamais choisie.
  const byKey = new Map(colors.map((c) => [colorKey(c.hex, c.alpha), c]));
  const theme = { ...DEFAULT_THEME_ROLE_COLORS };
  for (const [key, role] of Object.entries(colorRoles)) {
    const swatch = byKey.get(key);
    if (swatch) theme[role] = hexToRgb(swatch.hex);
  }
  for (const [role, hex] of Object.entries(roleColorOverrides) as [ThemeColorRole, string][]) {
    theme[role] = hexToRgb(hex);
  }
  return theme;
}

function recolor(color: IRColor, colorRoles: Record<string, ThemeColorRole>): IRColor {
  const role = colorRoles[colorKey(toHex(color), color.a)];
  return role ? { ...color, themeRole: role } : color;
}

/**
 * Applique les rôles de thème assignés (onglet Style) aux couleurs des
 * éléments déjà sérialisés, en amont de l'envoi au backend — pure et
 * immutable comme le reste de `serialize/` : renvoie de nouveaux éléments,
 * ne mute jamais ceux passés en entrée.
 */
export function applyThemeRolesToElements(elements: IRElement[], colorRoles: Record<string, ThemeColorRole>): IRElement[] {
  if (Object.keys(colorRoles).length === 0) return elements;

  return elements.map((el): IRElement => {
    switch (el.kind) {
      case 'shape': {
        const shape = el as IRShape;
        return {
          ...shape,
          fill: shape.fill ? { ...shape.fill, color: recolor(shape.fill.color, colorRoles) } : shape.fill,
          stroke: shape.stroke ? { ...shape.stroke, color: recolor(shape.stroke.color, colorRoles) } : shape.stroke,
        };
      }
      case 'line': {
        const line = el as IRLine;
        return { ...line, stroke: { ...line.stroke, color: recolor(line.stroke.color, colorRoles) } };
      }
      case 'text': {
        const text = el as IRText;
        return { ...text, runs: text.runs.map((run) => ({ ...run, color: recolor(run.color, colorRoles) })) };
      }
      case 'image':
        return el;
    }
  });
}
