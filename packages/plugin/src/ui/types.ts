/**
 * Types et helpers partagés entre le shell de l'UI (ui.tsx) et les deux
 * panneaux de mode (DeckPanel.tsx / TemplatePanel.tsx) — découpage du
 * composant unique historique de ui.tsx en une partie deck et une partie
 * template (cf. audit UI).
 */

export interface FrameCandidate {
  id: string;
  name: string;
  width: number;
  height: number;
}

export interface FontSubstitution {
  original: string;
  resolved: string;
}

/**
 * Avertissement de fidélité (natif vs rasterisé) calculé côté sandbox
 * (serialize/serializeFrame.ts, serialize/decisionTree.ts) et transporté tel
 * quel jusqu'à l'UI — même structure utilisée pour le panneau "Logs" du deck
 * et le rapport de template (TemplateWarning est un alias de celle-ci).
 */
export type WarningSeverity = 'info' | 'warning' | 'blocking';

export interface FrameWarning {
  code: string;
  severity: WarningSeverity;
  sourceNodeId: string;
  nodeName: string;
  message: string;
  /** Uniquement sur FONT_SUBSTITUTED — voir logEntryFlag.ts::logEntryTagText. */
  fontOriginal?: string;
  fontSubstitute?: string;
}

export interface FrameState extends FrameCandidate {
  previewDataUrl?: string;
  fontSubstitutions?: FontSubstitution[];
  nativeCount?: number;
  rasterCount?: number;
  warnings?: FrameWarning[];
}

/**
 * Rapport de contenu communicable (brief-creation-template-google-slides.md
 * — "focus d'abord sur le fonctionnement... couleurs, typos, layouts
 * notamment avec les placeholders"), calculé côté sandbox
 * (serialize/templateValidation.ts, serialize/templateSummary.ts) et
 * transporté tel quel jusqu'à l'UI.
 */
export type TemplateWarning = FrameWarning;

export interface TemplatePlaceholder {
  id: string;
  sourceNodeId: string;
  role: string;
  label: string;
}

export interface TemplateColorSwatch {
  hex: string;
  alpha: number;
  usageCount: number;
  variableName?: string;
}

export interface TemplateFontUsage {
  family: string;
  weights: number[];
  /** Police d'origine Figma si `family` vient d'une substitution — voir serialize/templateSummary.ts::summarizeFonts. */
  original?: string;
}

export interface TemplateLayoutState extends FrameCandidate {
  previewDataUrl?: string;
  warnings: TemplateWarning[];
  blocking: boolean;
  placeholders: TemplatePlaceholder[];
  colors: TemplateColorSwatch[];
  fonts: TemplateFontUsage[];
  fontSubstitutions?: FontSubstitution[];
}

export type AppMode = 'deck' | 'template';

/**
 * Habillage visuel de l'UI. `modern` est le skin PAR DÉFAUT (demande
 * produit) : palette et typo de marque (orange, Cabinet Grotesk), avec
 * biseaux et angles droits empruntés au chrome Windows 95 — sans reprendre
 * les éléments les plus identifiants de ce dernier (barre de titre, bleu
 * marine, trame, police système), qui restent exclusifs au second skin,
 * `win95` (même arborescence de composants, repeinte intégralement en
 * chrome Windows 95 : biseaux, gris #C0C0C0, barre de titre — voir
 * styles.modern.css et styles.win95.css). Le choix est persisté côté
 * sandbox via `clientStorage` (l'iframe UI n'a aucun stockage durable) —
 * voir code.ts.
 */
export type UiSkin = 'win95' | 'modern';

export const DEFAULT_UI_SKIN: UiSkin = 'modern';

/** Classe posée sur <html> pour le skin actif — les deux feuilles de style scopent leurs règles dessus. */
export function skinClassName(skin: UiSkin): string {
  return `f2s-skin--${skin}`;
}

/**
 * Skin réellement affiché au tout premier rendu : code.ts injecte la classe
 * du skin persisté directement dans le HTML servi à `figma.showUI` (avant
 * même la création de l'iframe — voir commentaire dans `main()`), donc
 * `<html>` porte déjà la bonne classe dès le montage de React. Partir d'ici
 * plutôt que de `DEFAULT_UI_SKIN` évite qu'un premier `useEffect` ne
 * réécrase cette classe par le skin par défaut avant que le message
 * `skin-restored` n'arrive.
 */
export function readInitialSkin(): UiSkin {
  const root = document.documentElement;
  if (root.classList.contains(skinClassName('win95'))) return 'win95';
  return DEFAULT_UI_SKIN;
}

export function postToPlugin(message: Record<string, unknown>): void {
  parent.postMessage({ pluginMessage: message }, '*');
}

/** Sélectionne dans Figma le(s) nœud(s) source visés par un avertissement ou un placeholder — partagé entre le rapport de fidélité du deck et celui du template. */
export function selectSourceNodes(sourceNodeIds: string[]): void {
  postToPlugin({ type: 'select-nodes', nodeIds: sourceNodeIds });
}
