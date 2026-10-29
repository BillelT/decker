/**
 * Formats de sortie du bouton Export (mode deck). Seuls les formats que Figma
 * ne produit pas déjà : PDF, PNG et SVG sont couverts par Figma, inutile de
 * les doubler ici. Tout part de la présentation Google Slides créée par
 * l'export, téléchargée via le lien d'export de Google : aucune API Drive
 * côté backend, donc aucun scope de plus (le lien s'ouvre dans la session
 * Google de l'utilisateur, propriétaire du fichier).
 */
export type ExportFormat = 'slides' | 'pptx' | 'odp';

export interface ExportFormatInfo {
  id: ExportFormat;
  /** Libellé du menu. */
  label: string;
  /** Extension affichée sur le bouton principal. */
  short: string;
  hint: string;
}

export const EXPORT_FORMATS: readonly ExportFormatInfo[] = [
  { id: 'slides', label: 'Google Slides', short: 'Slides', hint: 'Editable online' },
  { id: 'pptx', label: 'PowerPoint (.pptx)', short: 'PPTX', hint: 'PowerPoint, Keynote' },
  { id: 'odp', label: 'OpenDocument (.odp)', short: 'ODP', hint: 'LibreOffice, Impress' },
];

/** Lien de téléchargement Google d'une présentation, ou `undefined` pour Slides (rien à télécharger) ou une URL inattendue. */
export function exportDownloadUrl(presentationUrl: string | undefined, format: ExportFormat): string | undefined {
  if (format === 'slides' || !presentationUrl) return undefined;
  const id = /\/presentation\/d\/([\w-]+)/.exec(presentationUrl)?.[1];
  return id ? `https://docs.google.com/presentation/d/${id}/export/${format}` : undefined;
}
