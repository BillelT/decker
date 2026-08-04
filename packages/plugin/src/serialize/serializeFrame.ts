import type { IRElement, IRImage, IRLine, IRPaint, IRShape, IRSlide, IRWarning } from '@figma-to-slides/shared';
import { classifyNode, type DecisionInput, type NodeKind } from './decisionTree.js';
import { decideRadius, type RadiusDecision } from './radius.js';
import { extractTextRuns } from './textExtract.js';
import { mapVerticalAlignment } from './textMapping.js';
import { shouldRasterForStroke } from './stroke.js';
import { findUnknownPlaceholderTag, KNOWN_ROLE_TAGS, parsePlaceholderTag } from './placeholder.js';
import type { createIdGenerator } from './ids.js';

export interface SerializeContext {
  nextId: ReturnType<typeof createIdGenerator>;
}

/**
 * Adapte le SceneNode réel vers les primitives pures de `stroke.ts`. Le
 * défaut Figma pour une forme SANS contour est déjà `strokeAlign: 'INSIDE'`
 * — sans le filtre sur les strokes visibles, ça déclenchait un raster
 * quasi systématique avant ce correctif (spec §3.3).
 */
function evaluateStroke(node: SceneNode): boolean {
  if (!('strokes' in node)) return false;
  const visibleStrokeCount = node.strokes.filter((s) => s.visible !== false).length;
  const weight = 'strokeWeight' in node ? node.strokeWeight : 0;
  const align = 'strokeAlign' in node ? node.strokeAlign : 'CENTER';

  return shouldRasterForStroke({
    visibleStrokeCount,
    weightIsMixed: weight === figma.mixed,
    weight: weight === figma.mixed ? 0 : (weight as number),
    align: align as 'CENTER' | 'INSIDE' | 'OUTSIDE',
  });
}

/**
 * Spec §3.4 — aplatit la hiérarchie d'une frame en une liste d'IRElement,
 * positions recalculées en absolu par rapport à la frame racine (spec §5.4
 * pour les objectId, §3.3 pour la décision native/raster à chaque nœud).
 */
export async function serializeFrame(frame: FrameNode | ComponentNode | InstanceNode, ctx: SerializeContext): Promise<{ slide: Omit<IRSlide, 'order' | 'previewDataUrl'>; nodesToRaster: Map<string, SceneNode[]> }> {
  const elements: IRElement[] = [];
  const warnings: IRWarning[] = [];
  const nodesToRaster = new Map<string, SceneNode[]>(); // assetKey (== element id) -> nœuds Figma aplatis dedans

  const rootX = frame.absoluteBoundingBox?.x ?? frame.x;
  const rootY = frame.absoluteBoundingBox?.y ?? frame.y;

  const background = uniformFrameBackground(frame);

  for (const child of frame.children) {
    await walk(child, { rootX, rootY, ctx, elements, warnings, nodesToRaster });
  }

  return {
    slide: {
      sourceNodeId: frame.id,
      frameName: frame.name,
      frameSize: { width: frame.width, height: frame.height },
      background,
      elements,
      warnings,
    },
    nodesToRaster,
  };
}

interface WalkState {
  rootX: number;
  rootY: number;
  ctx: SerializeContext;
  elements: IRElement[];
  warnings: IRWarning[];
  nodesToRaster: Map<string, SceneNode[]>;
  maskedByAncestor?: boolean;
}

async function walk(node: SceneNode, state: WalkState): Promise<void> {
  // Faute de frappe dans un tag de placeholder (`[[titel]]`…) : sans ce
  // warning, le tag était ignoré en silence et le créateur du template ne
  // découvrait le placeholder manquant qu'après livraison. Vérifié sur TOUT
  // nœud (y compris un conteneur), avant même la décision natif/raster.
  const unknownTag = findUnknownPlaceholderTag(node.name);
  if (unknownTag) {
    state.warnings.push({
      code: 'PLACEHOLDER_TAG_UNKNOWN',
      severity: 'warning',
      sourceNodeId: node.id,
      nodeName: node.name,
      message: `Unknown placeholder tag "[[${unknownTag}]]" — use one of: ${KNOWN_ROLE_TAGS.map((r) => `[[${r}]]`).join(', ')}.`,
    });
  }

  const decision = classifyNode(toDecisionInput(node, state.maskedByAncestor ?? false));

  switch (decision.action) {
    case 'ignore':
      return;

    case 'raster': {
      const id = state.ctx.nextId();
      pushRasterPlaceholder(node, id, state);
      state.nodesToRaster.set(id, [node]);
      state.warnings.push({
        code: decision.warningCode,
        severity: decision.warningCode === 'FONT_MISSING' ? 'blocking' : 'warning',
        sourceNodeId: node.id,
        nodeName: node.name,
        message: decision.message,
      });
      return;
    }

    case 'image': {
      const id = state.ctx.nextId();
      state.elements.push(buildImagePlaceholder(node, id, state, false));
      state.nodesToRaster.set(id, [node]);
      return;
    }

    case 'native-text': {
      const textNode = node as TextNode;
      const extraction = extractTextRuns(textNode);
      if (extraction.requiresRaster) {
        const id = state.ctx.nextId();
        pushRasterPlaceholder(node, id, state);
        state.nodesToRaster.set(id, [node]);
        state.warnings.push({
          code: 'LETTER_SPACING_LOST',
          severity: 'warning',
          sourceNodeId: node.id,
          nodeName: node.name,
          message: extraction.rasterReason ?? 'Text converted to an image.',
        });
        return;
      }
      for (const w of extraction.fontWarnings) {
        if (w.substitute) {
          state.warnings.push({
            code: 'FONT_SUBSTITUTED',
            severity: 'info',
            sourceNodeId: node.id,
            nodeName: node.name,
            message: `Font "${w.original}" replaced with "${w.substitute}".`,
            fontOriginal: w.original,
            fontSubstitute: w.substitute,
          });
        }
      }
      const rel = relativeRect(node, state);
      state.elements.push({
        kind: 'text',
        id: state.ctx.nextId(),
        sourceNodeId: node.id,
        rect: rel,
        rotation: 'rotation' in node ? node.rotation : 0,
        opacity: 'opacity' in node ? node.opacity : 1,
        content: extraction.content,
        runs: extraction.runs,
        paragraphs: extraction.paragraphs,
        vAlign: mapVerticalAlignment((textNode.textAlignVertical as never) ?? 'TOP'),
        tightFit: textNode.textAutoResize === 'WIDTH_AND_HEIGHT',
        placeholder: parsePlaceholderTag(node.name),
      });
      return;
    }

    case 'native-shape-preset':
    case 'native-shape-ellipse':
    case 'native-shape-round-rectangle': {
      const shape = buildNativeShape(node, decision.action, state);
      state.elements.push(shape);
      if (decision.action === 'native-shape-round-rectangle' && decision.approximated) {
        state.warnings.push({
          code: 'RADIUS_APPROXIMATED',
          severity: 'info',
          sourceNodeId: node.id,
          nodeName: node.name,
          message: 'Corner radius is approximated by Slides (fixed, non-adjustable value).',
        });
      }
      return;
    }

    case 'native-line': {
      state.elements.push(buildNativeLine(node, state));
      return;
    }

    case 'descend': {
      const container = node as FrameNode | GroupNode | ComponentNode | InstanceNode;
      // §2.4/§7.1 RÈGLE z-order : le fond du conteneur, s'il y en a un, est
      // créé avant ses enfants (le plus en arrière) — même ordre que le fond
      // de la slide racine et l'underlay.
      if (decision.background) {
        state.elements.push(buildNativeShape(node, decision.background.action, state));
        if (decision.background.action === 'native-shape-round-rectangle' && decision.background.approximated) {
          state.warnings.push({
            code: 'RADIUS_APPROXIMATED',
            severity: 'info',
            sourceNodeId: node.id,
            nodeName: node.name,
            message: 'Corner radius is approximated by Slides (fixed, non-adjustable value).',
          });
        }
      }
      for (const child of container.children) {
        await walk(child, { ...state, maskedByAncestor: state.maskedByAncestor });
      }
      return;
    }
  }
}

export function toDecisionInput(node: SceneNode, maskedByAncestor: boolean): DecisionInput {
  const kind = nodeKind(node);
  const visible = 'visible' in node ? node.visible : true;
  const opacity = 'opacity' in node ? node.opacity : 1;
  const width = 'width' in node ? node.width : 0;
  const height = 'height' in node ? node.height : 0;
  const blendMode = 'blendMode' in node ? node.blendMode : 'NORMAL';
  const isMask = 'isMask' in node ? Boolean(node.isMask) : false;

  const input: DecisionInput = {
    kind,
    visible,
    opacity,
    width,
    height,
    blendMode,
    hasVisibleShadowOrBlur: hasVisibleShadowOrBlur(node),
    isMasked: isMask || maskedByAncestor,
  };

  if (kind === 'TEXT') {
    // La décision fine (police manquante, letterSpacing) est calculée dans
    // `extractTextRuns` — ici on laisse passer, le nœud sera re-évalué après
    // extraction complète (voir le cas 'native-text' dans `walk`).
    input.text = { fontUnavailable: false, letterSpacingExceedsThreshold: false, hasUnrepresentableMixedStyle: false };
  }

  if (kind === 'RECTANGLE' || kind === 'ELLIPSE' || kind === 'POLYGON' || kind === 'STAR') {
    input.shape = shapeInfo(node, kind);
  }

  if (kind === 'LINE') {
    input.line = lineInfo(node);
  }

  if (kind === 'GROUP_LIKE') {
    const clipsContent = 'clipsContent' in node ? Boolean(node.clipsContent) : false;
    input.container = {
      clipsContentWithOverflow: clipsContent && childrenOverflow(node as FrameNode),
      // Un GROUP (contrairement à FRAME/COMPONENT/INSTANCE) n'a pas de `fills` — pas de fond propre possible.
      fill: 'fills' in node ? shapeInfo(node, 'GROUP_LIKE') : undefined,
    };
  }

  return input;
}

function nodeKind(node: SceneNode): NodeKind {
  switch (node.type) {
    case 'TEXT':
      return 'TEXT';
    case 'RECTANGLE':
      return 'RECTANGLE';
    case 'ELLIPSE':
      return 'ELLIPSE';
    case 'LINE':
      return 'LINE';
    case 'POLYGON':
      return 'POLYGON';
    case 'STAR':
      return 'STAR';
    case 'VECTOR':
    case 'BOOLEAN_OPERATION':
      return 'VECTOR_LIKE';
    case 'GROUP':
    case 'FRAME':
    case 'COMPONENT':
    case 'INSTANCE':
      return 'GROUP_LIKE';
    default:
      return 'OTHER';
  }
}

function hasVisibleShadowOrBlur(node: SceneNode): boolean {
  if (!('effects' in node)) return false;
  return node.effects.some((e) => e.visible && (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW' || e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR'));
}

function childrenOverflow(frame: FrameNode): boolean {
  return frame.children.some((c) => {
    const box = c.absoluteBoundingBox;
    const parentBox = frame.absoluteBoundingBox;
    if (!box || !parentBox) return false;
    return box.x < parentBox.x || box.y < parentBox.y || box.x + box.width > parentBox.x + parentBox.width || box.y + box.height > parentBox.y + parentBox.height;
  });
}

function shapeInfo(node: SceneNode, kind: NodeKind): DecisionInput['shape'] {
  const fills = 'fills' in node && node.fills !== figma.mixed ? (node.fills as readonly Paint[]) : [];
  const visibleFills = fills.filter((f) => f.visible !== false);
  const fillIsGradient = visibleFills.some((f) => f.type.startsWith('GRADIENT'));
  const fillIsImage = visibleFills.length === 1 && visibleFills[0].type === 'IMAGE';

  const hasMultipleOrOffCenterStroke = evaluateStroke(node);

  let radiusDecision: RadiusDecision | undefined;
  if ((kind === 'RECTANGLE' || kind === 'GROUP_LIKE') && 'topLeftRadius' in node) {
    radiusDecision = decideRadius(
      {
        topLeft: node.topLeftRadius,
        topRight: node.topRightRadius,
        bottomLeft: node.bottomLeftRadius,
        bottomRight: node.bottomRightRadius,
      },
      node.width,
      node.height,
    );
  }

  return { visibleFillCount: visibleFills.length, fillIsGradient, fillIsImage, hasMultipleOrOffCenterStroke, radiusDecision };
}

// Terminaisons cosmétiques (arrondi/carré, pas de décoration) qu'on peut
// représenter en n'ajoutant aucune flèche Slides ; toute autre valeur (flèche,
// losange, cercle plein…) nécessiterait de mapper vers startArrow/endArrow,
// non fait ici — la ligne est rasterisée pour rester fidèle plutôt que de
// perdre silencieusement la décoration.
export const SUPPORTED_LINE_CAPS = new Set(['NONE', 'ROUND', 'SQUARE']);

function lineInfo(node: SceneNode): DecisionInput['line'] {
  const strokes = 'strokes' in node ? node.strokes.filter((s) => s.visible !== false) : [];
  const strokeIsGradient = strokes.some((s) => s.type.startsWith('GRADIENT'));
  const weight = 'strokeWeight' in node ? node.strokeWeight : 0;
  const strokeWeightIsMixed = weight === figma.mixed;
  const cap = 'strokeCap' in node ? node.strokeCap : 'NONE';
  const hasUnsupportedCap = cap === figma.mixed || cap === undefined || !SUPPORTED_LINE_CAPS.has(cap);
  return { visibleStrokeCount: strokes.length, strokeIsGradient, strokeWeightIsMixed, hasUnsupportedCap };
}

/**
 * Piège Figma classique : `absoluteBoundingBox` est la boîte englobante
 * APRÈS rotation (AABB axis-aligned) — sa largeur/hauteur et sa position ne
 * correspondent plus à la boîte locale non tournée une fois `node.rotation`
 * ≠ 0 (ex. un rectangle 920×4 tourné à -90° a un AABB d'environ 4×920).
 * `rotatedTransform` (mapper backend) attend au contraire la boîte LOCALE
 * pré-rotation (coin haut-gauche + largeur/hauteur non tournées), qu'il
 * tourne lui-même ensuite autour de SON CENTRE — exactement le modèle de
 * Figma pour `x`/`y`/`width`/`height`/`rotation` (la rotation y est
 * toujours appliquée autour du centre, qui reste donc fixe).
 *
 * Le centre étant invariant par rotation, le centre de l'AABB (qui, lui,
 * *est* fiable) est aussi celui de la boîte non tournée : on reconstruit
 * donc le coin haut-gauche pré-rotation en repartant de ce centre avec les
 * dimensions locales (`node.width`/`height`, jamais affectées par la
 * rotation), plutôt que depuis `absoluteTransform` — dont la translation
 * donne la position du coin APRÈS rotation, pas avant (piège différent,
 * casse la position même si l'orientation devient correcte).
 */
function relativeRect(node: SceneNode, state: WalkState): { x: number; y: number; w: number; h: number } {
  const rotation = 'rotation' in node ? node.rotation : 0;
  const box = node.absoluteBoundingBox;
  if (!box) return { x: 0, y: 0, w: 'width' in node ? node.width : 0, h: 'height' in node ? node.height : 0 };
  if (rotation !== 0 && 'width' in node && 'height' in node) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    return { x: cx - node.width / 2 - state.rootX, y: cy - node.height / 2 - state.rootY, w: node.width, h: node.height };
  }
  return { x: box.x - state.rootX, y: box.y - state.rootY, w: box.width, h: box.height };
}

/**
 * `absoluteBoundingBox` exclut explicitement les contours et ombres portées
 * (doc Figma : "does not include rendered properties like drop shadows or
 * strokes"). Pour une image rasterisée — dont le contenu VIENT du rendu
 * visuel via `exportAsync` — il faut la taille qui inclut ce rendu
 * (`absoluteRenderBounds`), sinon une LINE (boîte de fond nulle sur un axe,
 * tout son contenu visible venant du stroke) obtient un rect de taille 0,
 * ce que l'API Slides rejette pour `createImage` (échec de tout l'export
 * de la slide, spec LIMITATIONS.md — lignes toujours rasterisées).
 */
function relativeRenderRect(node: SceneNode, state: WalkState): { x: number; y: number; w: number; h: number } {
  const renderBounds = 'absoluteRenderBounds' in node ? node.absoluteRenderBounds : null;
  const box = renderBounds ?? node.absoluteBoundingBox;
  if (!box) return { x: 0, y: 0, w: 'width' in node ? node.width : 0, h: 'height' in node ? node.height : 0 };
  return { x: box.x - state.rootX, y: box.y - state.rootY, w: box.width, h: box.height };
}

function buildNativeShape(node: SceneNode, action: 'native-shape-preset' | 'native-shape-ellipse' | 'native-shape-round-rectangle', state: WalkState): IRShape {
  const rel = relativeRect(node, state);
  const fills = 'fills' in node && node.fills !== figma.mixed ? (node.fills as readonly Paint[]) : [];
  const solidFill = fills.find((f): f is SolidPaint => f.type === 'SOLID' && f.visible !== false);
  const fill: IRPaint | undefined = solidFill
    ? { type: 'SOLID', color: { r: solidFill.color.r, g: solidFill.color.g, b: solidFill.color.b, a: solidFill.opacity ?? 1 } }
    : undefined;

  const strokes = 'strokes' in node ? node.strokes.filter((s) => s.visible !== false) : [];
  const strokeSolid = strokes.find((s): s is SolidPaint => s.type === 'SOLID');
  const strokeWeight = 'strokeWeight' in node && typeof node.strokeWeight === 'number' ? node.strokeWeight : 0;
  const stroke = strokeSolid && strokeWeight > 0
    ? { color: { r: strokeSolid.color.r, g: strokeSolid.color.g, b: strokeSolid.color.b, a: strokeSolid.opacity ?? 1 }, weightPt: strokeWeight, dash: dashStyleOf(node) }
    : undefined;

  const shapeType = action === 'native-shape-ellipse' ? 'ELLIPSE' : action === 'native-shape-round-rectangle' ? 'ROUND_RECTANGLE' : presetShapeType(node);

  return {
    kind: 'shape',
    id: state.ctx.nextId(),
    sourceNodeId: node.id,
    rect: rel,
    rotation: 'rotation' in node ? node.rotation : 0,
    opacity: 'opacity' in node ? node.opacity : 1,
    shapeType,
    fill,
    stroke,
    placeholder: parsePlaceholderTag(node.name),
  };
}

function buildNativeLine(node: SceneNode, state: WalkState): IRLine {
  const rel = relativeRect(node, state);
  const strokes = 'strokes' in node ? node.strokes.filter((s) => s.visible !== false) : [];
  const strokeSolid = strokes.find((s): s is SolidPaint => s.type === 'SOLID');
  const strokeWeight = 'strokeWeight' in node && typeof node.strokeWeight === 'number' ? node.strokeWeight : 1;

  return {
    kind: 'line',
    id: state.ctx.nextId(),
    sourceNodeId: node.id,
    rect: rel,
    rotation: 'rotation' in node ? node.rotation : 0,
    opacity: 'opacity' in node ? node.opacity : 1,
    stroke: {
      color: strokeSolid
        ? { r: strokeSolid.color.r, g: strokeSolid.color.g, b: strokeSolid.color.b, a: strokeSolid.opacity ?? 1 }
        : { r: 0, g: 0, b: 0, a: 1 },
      weightPt: strokeWeight,
      dash: dashStyleOf(node),
    },
    placeholder: parsePlaceholderTag(node.name),
  };
}

function dashStyleOf(node: SceneNode): 'SOLID' | 'DASH' | 'DOT' {
  if ('dashPattern' in node && node.dashPattern.length > 0) {
    return node.dashPattern[0] > 4 ? 'DASH' : 'DOT';
  }
  return 'SOLID';
}

function presetShapeType(node: SceneNode): IRShape['shapeType'] {
  switch (node.type) {
    case 'ELLIPSE':
      return 'ELLIPSE';
    case 'STAR':
      return 'STAR_5';
    case 'POLYGON':
      return 'HEXAGON'; // approximation raisonnable ; à affiner par nombre de côtés réel
    default:
      return 'RECTANGLE';
  }
}

function buildImagePlaceholder(node: SceneNode, id: string, state: WalkState, isRasterFallback: boolean): IRImage {
  const rel = relativeRenderRect(node, state);
  return {
    kind: 'image',
    id,
    sourceNodeId: node.id,
    rect: rel,
    // `node.exportAsync` (code.ts) rend le nœud tel qu'affiché — la
    // rotation est donc déjà "cuite" dans les pixels du PNG exporté (dont
    // les dimensions correspondent à `relativeRenderRect`, l'AABB post-
    // rotation). Réappliquer `node.rotation` ici tournerait cette image
    // déjà orientée une seconde fois.
    rotation: 0,
    opacity: 'opacity' in node ? node.opacity : 1,
    assetKey: id,
    isRasterFallback,
    rasterizedNodeIds: isRasterFallback ? [node.id] : undefined,
    // Un raster fallback n'est jamais éditable : le tag est quand même
    // conservé (utile pour le rapport de template et signale au créateur
    // *quel* placeholder prévu a fini rasterisé), mais `templateValidation`
    // bloque de toute façon l'export tant qu'il subsiste.
    placeholder: parsePlaceholderTag(node.name),
  };
}

function pushRasterPlaceholder(node: SceneNode, id: string, state: WalkState): void {
  state.elements.push(buildImagePlaceholder(node, id, state, true));
}

function uniformFrameBackground(frame: FrameNode | ComponentNode | InstanceNode): IRPaint | undefined {
  const fills = frame.fills !== figma.mixed ? frame.fills : [];
  const visible = fills.filter((f) => f.visible !== false);
  if (visible.length !== 1 || visible[0].type !== 'SOLID') return undefined;
  const f = visible[0] as SolidPaint;
  return { type: 'SOLID', color: { r: f.color.r, g: f.color.g, b: f.color.b, a: f.opacity ?? 1 } };
}
