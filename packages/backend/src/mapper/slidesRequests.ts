/**
 * Sous-ensemble typé des requêtes `presentations.batchUpdate` de l'API
 * Google Slides v1 réellement utilisées par le mapper (spec §2, §6).
 * On ne dépend pas du client `googleapis` complet ici : ces types sont
 * suffisants pour construire un payload JSON valide et rester testables
 * sans réseau.
 */

import type { ThemeColorRole } from '@figma-to-slides/shared';

export interface Dimension {
  magnitude: number;
  unit: 'PT' | 'EMU';
}

export interface RgbColor {
  red?: number;
  green?: number;
  blue?: number;
}

/**
 * `ThemeColorRole` (contrat IR) EST le `ThemeColorType` de l'API Slides —
 * mêmes 12 valeurs, réutilisées telles quelles plutôt que redéfinies ici.
 */
export type ThemeColorType = ThemeColorRole;

/** Un `OpaqueColor` porte soit une couleur figée, soit une liaison à un slot du thème (audit 2026-08) — jamais les deux. */
export type OpaqueColor = { rgbColor: RgbColor } | { themeColor: ThemeColorType };

export interface SolidFill {
  color: OpaqueColor;
  alpha?: number;
}

export interface AffineTransform {
  scaleX: number;
  scaleY: number;
  shearX: number;
  shearY: number;
  translateX: number;
  translateY: number;
  unit: 'PT' | 'EMU';
}

export interface PageElementProperties {
  pageObjectId: string;
  size: { width: Dimension; height: Dimension };
  transform: AffineTransform;
}

export type ShapeType =
  | 'RECTANGLE'
  | 'ROUND_RECTANGLE'
  | 'ELLIPSE'
  | 'TRIANGLE'
  | 'DIAMOND'
  | 'RIGHT_TRIANGLE'
  | 'PARALLELOGRAM'
  | 'HEXAGON'
  | 'PENTAGON'
  | 'STAR_5'
  | 'RIGHT_ARROW'
  | 'TEXT_BOX';

export interface CreateShapeRequest {
  objectId: string;
  shapeType: ShapeType;
  elementProperties: PageElementProperties;
}

export interface CreateImageRequest {
  objectId: string;
  url: string;
  elementProperties: PageElementProperties;
}

export type LineCategory = 'STRAIGHT';

export interface CreateLineRequest {
  objectId: string;
  lineCategory: LineCategory;
  elementProperties: PageElementProperties;
}

export interface LineProperties {
  lineFill?: { solidFill: SolidFill };
  weight?: Dimension;
  dashStyle?: 'SOLID' | 'DASH' | 'DOT';
}

export interface UpdateLinePropertiesRequest {
  objectId: string;
  lineProperties: LineProperties;
  fields: string;
}

export interface CreateSlideRequest {
  objectId: string;
  insertionIndex?: number;
}

export interface TextRange {
  type: 'FIXED_RANGE' | 'ALL';
  startIndex?: number;
  endIndex?: number;
}

export interface InsertTextRequest {
  objectId: string;
  text: string;
  insertionIndex?: number;
}

export interface WeightedFontFamily {
  fontFamily: string;
  weight: number;
}

export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  smallCaps?: boolean;
  fontSize?: Dimension;
  weightedFontFamily?: WeightedFontFamily;
  foregroundColor?: { opaqueColor: OpaqueColor };
  link?: { url: string };
}

export interface UpdateTextStyleRequest {
  objectId: string;
  textRange: TextRange;
  style: TextStyle;
  fields: string;
}

export interface ParagraphStyle {
  alignment?: 'START' | 'CENTER' | 'END' | 'JUSTIFIED';
  lineSpacing?: number; // %
  spaceAbove?: Dimension;
  spaceBelow?: Dimension;
  indentStart?: Dimension;
}

export interface UpdateParagraphStyleRequest {
  objectId: string;
  textRange: TextRange;
  style: ParagraphStyle;
  fields: string;
}

export interface CreateParagraphBulletsRequest {
  objectId: string;
  textRange: TextRange;
  bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE' | 'NUMBERED_DIGIT_ALPHA_ROMAN';
}

export interface PropertyState {
  propertyState: 'RENDERED' | 'NOT_RENDERED';
}

export interface Outline {
  outlineFill?: { solidFill: SolidFill };
  weight?: Dimension;
  dashStyle?: 'SOLID' | 'DASH' | 'DOT';
  propertyState?: 'RENDERED' | 'NOT_RENDERED';
}

export interface ShapeProperties {
  shapeBackgroundFill?: { solidFill: SolidFill };
  outline?: Outline;
  contentAlignment?: 'TOP' | 'MIDDLE' | 'BOTTOM';
  autofit?: { autofitType: 'NONE' | 'AUTOFIT_TYPE_UNSPECIFIED' };
}

export interface UpdateShapePropertiesRequest {
  objectId: string;
  shapeProperties: ShapeProperties;
  fields: string;
}

export interface UpdatePageElementsZOrderRequest {
  pageElementObjectIds: string[];
  operation: 'BRING_TO_FRONT' | 'BRING_FORWARD' | 'SEND_BACKWARD' | 'SEND_TO_BACK';
}

export interface DeleteObjectRequest {
  objectId: string;
}

/**
 * Création de template (spec brief-creation-template-google-slides.md) :
 * l'API Slides n'expose aucune création de Placeholder/Master/Layout
 * personnalisé en écriture (seuls les layouts prédéfinis à la création de
 * la présentation existent). Le rôle de placeholder assigné dans Figma est
 * donc porté en alt text — le seul champ générique disponible sur
 * n'importe quel type de page element — plutôt que perdu à l'export.
 */
export interface UpdatePageElementAltTextRequest {
  objectId: string;
  title?: string;
  description?: string;
}

/**
 * Écriture du vrai thème Slides (audit 2026-08 — voir LIMITATIONS.md §
 * Création de template) : `PageProperties.colorScheme` n'est modifiable
 * qu'en ciblant la page `Master`, et seulement en fournissant les 12
 * premiers `ThemeColorType` d'un coup (confirmé sur le schéma officiel de
 * l'API ET en conditions réelles, voir `spikes/masterThemeSpike.ts`).
 */
export interface ThemeColorPair {
  type: ThemeColorType;
  color: RgbColor;
}

export interface ColorScheme {
  colors: ThemeColorPair[];
}

export interface UpdatePagePropertiesRequest {
  objectId: string;
  pageProperties: { colorScheme: ColorScheme };
  fields: string;
}

/** Une entrée du tableau `requests` d'un `presentations.batchUpdate`. */
export type SlidesRequest =
  | { createSlide: CreateSlideRequest }
  | { createShape: CreateShapeRequest }
  | { createImage: CreateImageRequest }
  | { createLine: CreateLineRequest }
  | { updateLineProperties: UpdateLinePropertiesRequest }
  | { insertText: InsertTextRequest }
  | { updateTextStyle: UpdateTextStyleRequest }
  | { updateParagraphStyle: UpdateParagraphStyleRequest }
  | { createParagraphBullets: CreateParagraphBulletsRequest }
  | { updateShapeProperties: UpdateShapePropertiesRequest }
  | { updatePageElementsZOrder: UpdatePageElementsZOrderRequest }
  | { updatePageElementAltText: UpdatePageElementAltTextRequest }
  | { updatePageProperties: UpdatePagePropertiesRequest }
  | { deleteObject: DeleteObjectRequest };

/** Un lot indivisible : toutes les requêtes d'une slide (spec §5.4). */
export interface RequestBatch {
  sourceSlideId: string;
  requests: SlidesRequest[];
}
