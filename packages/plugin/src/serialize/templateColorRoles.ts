import type { ThemeColorRole } from '@figma-to-slides/shared';
import { colorKey, type ColorUsage, type TemplateColorSwatch } from './templateSummary.js';

/**
 * "Suggest roles" de la section Colors (mode template) : propose un rôle
 * de thème Slides pour chaque couleur détectée, d'après ce à quoi elle
 * SERT dans les layouts, jamais d'après sa luminosité. Une palette sombre
 * met son texte en clair : la couleur la plus foncée n'est pas forcément
 * celle du texte, mais la couleur la plus écrite l'est.
 *
 * Ordre d'attribution (le premier servi gagne la couleur) :
 * 1. Text & background 2 (`LIGHT1`, fond par défaut des slides) : le fond
 *    de frame le plus fréquent parmi les layouts (à défaut, le plus grand
 *    aplat de fond) ;
 * 2. Text & background 1 (`DARK1`, texte par défaut) : la plus écrite ;
 * 3. Link (`HYPERLINK`) : la plus utilisée sur des liens ;
 * 4. Text & background 3 (`DARK2`) : le deuxième texte, s'il est neutre ;
 *    Text & background 4 (`LIGHT2`) : le deuxième fond de frame le plus
 *    fréquent, quelle que soit sa teinte, sinon un aplat de fond neutre ;
 * 5. Accent 1 à 6 : les couleurs vives restantes, portées par des éléments
 *    (aplats, contours, mots colorés), de la plus présente à la moins.
 *
 * Ne touche jamais à ce que le créateur a déjà choisi : un rôle déjà pris
 * et une couleur qui a déjà un rôle sont laissés tels quels. Une couleur
 * semi-transparente n'est jamais proposée (un voile n'est pas une couleur
 * de thème).
 */

/** En dessous, une couleur est un gris : elle ne fait pas un accent. */
const ACCENT_MIN_CHROMA = 0.15;

const ACCENT_ROLES: ThemeColorRole[] = ['ACCENT1', 'ACCENT2', 'ACCENT3', 'ACCENT4', 'ACCENT5', 'ACCENT6'];

function chroma(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return Math.max(...channels) - Math.min(...channels);
}

function usageOf(c: TemplateColorSwatch): ColorUsage {
  return c.usage ?? { frame: 0, text: 0, link: 0, background: 0, fill: 0, stroke: 0 };
}

/** Un mot coloré pèse moins qu'un aplat : 20 caractères valent un élément. */
function accentScore(c: TemplateColorSwatch): number {
  const u = usageOf(c);
  return u.frame + u.fill + u.stroke + u.background + u.text / 20;
}

export function suggestColorRoles(colors: TemplateColorSwatch[], current: Record<string, ThemeColorRole>): Record<string, ThemeColorRole> {
  const next = { ...current };
  const takenRoles = new Set(Object.values(current));
  const free = colors.filter((c) => c.alpha >= 0.99 && !(colorKey(c.hex, c.alpha) in current));

  const assign = (role: ThemeColorRole, score: (c: TemplateColorSwatch) => number, accept: (c: TemplateColorSwatch) => boolean = () => true) => {
    if (takenRoles.has(role)) return;
    let best: TemplateColorSwatch | undefined;
    for (const c of free) {
      if (score(c) <= 0 || !accept(c)) continue;
      if (!best || score(c) > score(best)) best = c;
    }
    if (!best) return;
    next[colorKey(best.hex, best.alpha)] = role;
    takenRoles.add(role);
    free.splice(free.indexOf(best), 1);
  };

  // Un fond de frame l'emporte toujours sur un aplat : c'est le vrai fond
  // des slides. À nombre de layouts égal, la plus grande surface d'aplat
  // départage.
  const asBackground = (c: TemplateColorSwatch) => usageOf(c).frame * 1000 + usageOf(c).background;
  assign('LIGHT1', asBackground);
  assign('DARK1', (c) => usageOf(c).text);
  assign('HYPERLINK', (c) => usageOf(c).link);
  // Un gris secondaire (légende, carte) fait un bon texte ou fond n°2 ; une
  // couleur vive y serait perdue pour les accents.
  const neutral = (c: TemplateColorSwatch) => chroma(c.hex) < ACCENT_MIN_CHROMA;
  assign('DARK2', (c) => usageOf(c).text, neutral);
  if (free.some((c) => usageOf(c).frame > 0)) assign('LIGHT2', asBackground, (c) => usageOf(c).frame > 0);
  else assign('LIGHT2', (c) => usageOf(c).background, neutral);
  for (const role of ACCENT_ROLES) assign(role, accentScore, (c) => chroma(c.hex) >= ACCENT_MIN_CHROMA);

  return next;
}
