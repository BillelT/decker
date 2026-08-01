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

export interface FrameState extends FrameCandidate {
  previewDataUrl?: string;
  fontSubstitutions?: FontSubstitution[];
}

/**
 * Rapport de contenu communicable (brief-creation-template-google-slides.md
 * — "focus d'abord sur le fonctionnement... couleurs, typos, layouts
 * notamment avec les placeholders"), calculé côté sandbox
 * (serialize/templateValidation.ts, serialize/templateSummary.ts) et
 * transporté tel quel jusqu'à l'UI.
 */
export type WarningSeverity = 'info' | 'warning' | 'blocking';

export interface TemplateWarning {
  code: string;
  severity: WarningSeverity;
  sourceNodeId: string;
  nodeName: string;
  message: string;
}

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
