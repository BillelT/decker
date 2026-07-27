/**
 * Sous-ensemble typé des requêtes `presentations.batchUpdate` de l'API
 * Google Slides v1 réellement utilisées par le mapper (spec §2, §6).
 * On ne dépend pas du client `googleapis` complet ici : ces types sont
 * suffisants pour construire un payload JSON valide et rester testables
 * sans réseau.
 */

export interface Dimension {
  magnitude: number;
  unit: 'PT' | 'EMU';
}

export interface RgbColor {
  red?: number;
  green?: number;
  blue?: number;
}

export interface OpaqueColor {
  rgbColor: RgbColor;
}

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

/** Une entrée du tableau `requests` d'un `presentations.batchUpdate`. */
export type SlidesRequest =
  | { createSlide: CreateSlideRequest }
  | { createShape: CreateShapeRequest }
  | { createImage: CreateImageRequest }
  | { insertText: InsertTextRequest }
  | { updateTextStyle: UpdateTextStyleRequest }
  | { updateParagraphStyle: UpdateParagraphStyleRequest }
  | { createParagraphBullets: CreateParagraphBulletsRequest }
  | { updateShapeProperties: UpdateShapePropertiesRequest }
  | { updatePageElementsZOrder: UpdatePageElementsZOrderRequest }
  | { deleteObject: DeleteObjectRequest };

/** Un lot indivisible : toutes les requêtes d'une slide (spec §5.4). */
export interface RequestBatch {
  sourceSlideId: string;
  requests: SlidesRequest[];
}
