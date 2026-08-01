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
}

export interface TemplateFontUsage {
  family: string;
  weights: number[];
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

export function postToPlugin(message: Record<string, unknown>): void {
  parent.postMessage({ pluginMessage: message }, '*');
}

/** Sélectionne dans Figma le(s) nœud(s) source visés par un avertissement ou un placeholder — partagé entre le rapport de fidélité du deck et celui du template. */
export function selectSourceNodes(sourceNodeIds: string[]): void {
  postToPlugin({ type: 'select-nodes', nodeIds: sourceNodeIds });
}
