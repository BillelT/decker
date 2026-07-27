/**
 * Contrat partagé entre le plugin Figma et le backend (spec §6).
 * Le mapper backend ne connaît QUE ce type ; il n'importe jamais de types Figma.
 */

export interface IRDocument {
  version: 1;
  presentationTitle: string;
  /** Si absent, une nouvelle présentation est créée. */
  targetPresentationId?: string;
  slideSize: { widthPt: number; heightPt: number };
  slides: IRSlide[];
  options: ExportOptions;
}

export interface IRSlide {
  /** id du nœud Figma source, pour la traçabilité. */
  sourceNodeId: string;
  frameName: string;
  /** Position finale dans le deck, 0-indexé. Modifiable par drag dans l'UI. */
  order: number;
  frameSize: { width: number; height: number }; // px Figma
  background?: IRPaint;
  /** Ordre arrière → avant. */
  elements: IRElement[];
  /** Diagnostics remontés à l'UI. */
  warnings: IRWarning[];
  /**
   * Aperçu bas-def pour la grille de l'UI (data URL PNG, largeur 320px).
   * Usage UI UNIQUEMENT : à retirer du payload avant l'envoi au backend.
   */
  previewDataUrl: string;
  /** Cf. §7.1 — image de contrôle en fond. */
  underlay?: IRUnderlay;
}

export type IRElement = IRText | IRShape | IRImage;

interface IRBase {
  id: string; // objectId Slides, généré côté plugin
  sourceNodeId: string;
  /** En px Figma, relatif au coin haut-gauche de la frame. */
  rect: { x: number; y: number; w: number; h: number };
  /** Degrés, antihoraire (convention Figma). */
  rotation: number;
  /** 0..1, produit node.opacity × fill.opacity. */
  opacity: number;
}

export interface IRText extends IRBase {
  kind: 'text';
  /** Contenu APRÈS application de textCase. */
  content: string;
  runs: IRTextRun[];
  paragraphs: IRParagraph[];
  vAlign: 'TOP' | 'MIDDLE' | 'BOTTOM';
}

export interface IRTextRun {
  start: number; // index de caractère (UTF-16), inclusif
  end: number; // exclusif
  fontFamily: string; // DÉJÀ résolu contre Google Fonts
  fontWeight: number; // 100..900
  italic: boolean;
  fontSizePx: number;
  color: IRColor;
  underline?: boolean;
  strikethrough?: boolean;
  smallCaps?: boolean;
  link?: string;
  /** Renseigné si substitution : affiché en avertissement. */
  originalFontFamily?: string;
}

export interface IRParagraph {
  start: number;
  end: number;
  align: 'START' | 'CENTER' | 'END' | 'JUSTIFIED';
  /** En %, convention Slides. undefined = hérité. */
  lineSpacingPct?: number;
  spaceAbovePt?: number;
  spaceBelowPt?: number;
  indentStartPt?: number;
  bullet?: 'UNORDERED' | 'ORDERED';
  bulletLevel?: number;
}

export interface IRShape extends IRBase {
  kind: 'shape';
  /** Valeur littérale de l'enum Slides Page.Type. */
  shapeType:
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
  fill?: IRPaint;
  stroke?: { color: IRColor; weightPt: number; dash: 'SOLID' | 'DASH' | 'DOT' };
}

export interface IRImage extends IRBase {
  kind: 'image';
  /** Clé de l'asset dans le payload binaire ; le backend la remplace par une URL. */
  assetKey: string;
  /** true si l'image est une rasterisation de fallback (≠ image d'origine). */
  isRasterFallback: boolean;
  /** Nœud(s) Figma aplati(s) dans ce raster — pour le rapport. */
  rasterizedNodeIds?: string[];
}

export type IRPaint = { type: 'SOLID'; color: IRColor };

export interface IRColor {
  r: number;
  g: number;
  b: number;
  a: number;
} // tous 0..1

export interface IRWarning {
  code:
    | 'FONT_SUBSTITUTED'
    | 'FONT_MISSING'
    | 'GRADIENT_RASTERIZED'
    | 'EFFECT_RASTERIZED'
    | 'BLEND_MODE_RASTERIZED'
    | 'MASK_RASTERIZED'
    | 'VECTOR_RASTERIZED'
    | 'LETTER_SPACING_LOST'
    | 'RADIUS_APPROXIMATED'
    | 'CORNER_RADIUS_RASTERIZED'
    | 'MULTIPLE_FILLS_RASTERIZED';
  severity: 'info' | 'warning' | 'blocking';
  sourceNodeId: string;
  nodeName: string;
  message: string; // formulé pour un designer, pas pour un dev
}

export interface ExportOptions {
  mode: 'new-presentation' | 'append-to-existing';
  rasterScale: 2 | 3 | 4;
  /** Cf. §7.1 */
  includeUnderlay: boolean;
  underlayOpacity: number; // 0..1, défaut 0.3
  /** Bloque l'export si un warning 'blocking' subsiste. */
  strictMode: boolean;
}

export interface IRUnderlay {
  assetKey: string;
  opacity: number;
}
