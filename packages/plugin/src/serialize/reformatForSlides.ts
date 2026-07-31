import { resolveFontFamily } from './fonts.js';
import { decideRadius, RADIUS_NATIVE_TOLERANCE } from './radius.js';
import { SUPPORTED_LINE_CAPS } from './serializeFrame.js';

type ExportableNode = FrameNode | ComponentNode | InstanceNode;

const NATIVE_SHAPE_TYPES = new Set(['RECTANGLE', 'ELLIPSE', 'POLYGON', 'STAR']);

/**
 * Brief "Nouveau flux proposé" point 2 — contrairement à `lintFrame.ts` (qui
 * se contente de repérer ce qui SERA rasterisé à l'export), cette fonction
 * MUTE la copie de vérification pour qu'elle corresponde déjà, sur le
 * canvas, à ce que Slides produira réellement : remplissages/contours
 * ramenés à un unique solide (dégradés/fills multiples inclus), rayons de
 * coin ramenés dans la plage supportée, ombres/flous retirés, polices
 * substituées, et texte ramené aux seules propriétés que Slides sait
 * représenter (pas de tracking, pas de "vertical trim", ligne "auto" →
 * valeur explicite). Ce qui reste non représentable après ce passage
 * (icônes vectorielles, masques, mode de fusion non standard…) n'a
 * volontairement aucun équivalent Slides — `lintFrame.ts`, exécuté après,
 * le signale.
 */
export async function reformatForSlides(root: ExportableNode, fontOverrides: Record<string, string>): Promise<void> {
  flattenFills(root);
  for (const child of root.children) {
    await walk(child, fontOverrides);
  }
}

async function walk(node: SceneNode, fontOverrides: Record<string, string>): Promise<void> {
  if ('visible' in node && !node.visible) return;
  stripUnsupportedEffects(node);

  if (node.type === 'TEXT') {
    await reformatText(node, fontOverrides);
    return;
  }

  if (NATIVE_SHAPE_TYPES.has(node.type)) {
    flattenFills(node);
    flattenStroke(node);
    if (node.type === 'RECTANGLE') normalizeCornerRadius(node);
  } else if (node.type === 'LINE') {
    flattenStroke(node);
    normalizeLineCap(node);
  }

  if ('children' in node) {
    for (const child of node.children) await walk(child, fontOverrides);
  }
}

/**
 * Slides n'accepte qu'un unique remplissage solide (LIMITATIONS.md —
 * dégradés et fills multiples non supportés) : plutôt que de laisser ces
 * calques filer vers la rasterisation à l'export, on les ramène ICI à leur
 * couleur solide la plus représentative, pour qu'ils restent NATIFS et
 * éditables — le remplissage d'origine, lui, reste inchangé sur la frame
 * source.
 */
function flattenFills(node: SceneNode): void {
  if (!('fills' in node) || node.fills === figma.mixed) return;
  const fills = node.fills as Paint[];
  const visible = fills.filter((f) => f.visible !== false);
  if (visible.length === 0) return;
  if (visible.length === 1 && (visible[0].type === 'SOLID' || visible[0].type === 'IMAGE')) return;
  // Un empilement qui contient une image n'a pas d'approximation solide
  // raisonnable — la remplacer par une couleur perdrait la photo elle-même,
  // pas juste un dégradé. On laisse alors les fills tels quels : l'arbre de
  // décision (`decisionTree.ts`, `visibleFillCount > 1`) rasterise le nœud à
  // l'export, ce qui préserve l'empilement complet — même résultat qu'un
  // export direct sans "Prepare for Slides".
  if (visible.some((f) => f.type === 'IMAGE')) return;
  const solid = representativeSolidColor(visible);
  if (solid) node.fills = [solid];
}

/** Même logique que `flattenFills`, côté contour : un seul contour solide, centré (Slides ne connaît pas "intérieur"/"extérieur"). */
function flattenStroke(node: SceneNode): void {
  if (!('strokes' in node)) return;
  const strokes = node.strokes.filter((s) => s.visible !== false);
  if (strokes.length > 0) {
    const alreadySingleSolid = strokes.length === 1 && strokes[0].type === 'SOLID';
    if (!alreadySingleSolid) {
      const solid = representativeSolidColor(strokes);
      if (solid) node.strokes = [solid];
    }
    if ('strokeAlign' in node) node.strokeAlign = 'CENTER';
    normalizeStrokeWeight(node);
  }
}

function representativeSolidColor(paints: readonly Paint[]): SolidPaint | undefined {
  for (let i = paints.length - 1; i >= 0; i--) {
    const p = paints[i];
    if (p.type === 'SOLID') return { type: 'SOLID', color: p.color, opacity: p.opacity ?? 1 };
  }
  // Aucun solide trouvé : dérive une couleur représentative du premier stop
  // du dégradé le plus au-dessus — approximation raisonnable plutôt que de
  // renoncer et laisser le calque partir en rasterisation.
  for (let i = paints.length - 1; i >= 0; i--) {
    const p = paints[i];
    if (p.type.startsWith('GRADIENT')) {
      const stop = (p as GradientPaint).gradientStops[0];
      if (stop) {
        return { type: 'SOLID', color: { r: stop.color.r, g: stop.color.g, b: stop.color.b }, opacity: stop.color.a * (p.opacity ?? 1) };
      }
    }
  }
  return undefined;
}

/** Un contour à épaisseur indépendante par côté (`figma.mixed`) n'a pas d'équivalent Slides (une seule épaisseur) : moyenne des 4 côtés. */
function normalizeStrokeWeight(node: SceneNode): void {
  if (!('strokeWeight' in node) || node.strokeWeight !== figma.mixed) return;
  const sideKeys = ['strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight'] as const;
  const values = sideKeys.filter((k) => k in node).map((k) => (node as unknown as Record<string, number>)[k]);
  if (values.length === 0) return;
  (node as RectangleNode).strokeWeight = values.reduce((a, b) => a + b, 0) / values.length;
}

/** Ombres portées/internes et flous : jamais supportés en écriture par Slides (LIMITATIONS.md) — retirés pour que la copie ne mente pas sur le rendu final. */
function stripUnsupportedEffects(node: SceneNode): void {
  if (!('effects' in node) || node.effects.length === 0) return;
  const kept = node.effects.filter((e) => !(e.visible && (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW' || e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR')));
  if (kept.length !== node.effects.length) node.effects = kept;
}

/** Terminaison décorative (flèche, losange, cercle…) sans équivalent Slides (LIMITATIONS.md) — ramenée à une terminaison plate représentable. */
function normalizeLineCap(node: LineNode): void {
  const cap = node.strokeCap;
  if (cap === figma.mixed || !SUPPORTED_LINE_CAPS.has(cap)) {
    node.strokeCap = 'NONE';
  }
}

/**
 * Slides impose un rayon de coin uniforme dans une plage donnée
 * (`RADIUS_NATIVE_TOLERANCE`, radius.ts) — même arbre de décision qu'à
 * l'export. Un rayon hors plage (ou non uniforme entre les 4 coins) est ICI
 * ramené dans la plage représentable plutôt que rasterisé : coins
 * uniformisés (moyenne), puis clampés à 0 (rectangle net) en dessous du
 * seuil minimal, ou au seuil maximal au-dessus (sans dépasser le point de
 * bascule vers l'ellipse/pilule, déjà géré nativement par `decideRadius`).
 */
function normalizeCornerRadius(node: RectangleNode): void {
  const radii = {
    topLeft: node.topLeftRadius,
    topRight: node.topRightRadius,
    bottomLeft: node.bottomLeftRadius,
    bottomRight: node.bottomRightRadius,
  };
  const decision = decideRadius(radii, node.width, node.height);
  if (decision.kind !== 'raster') return;

  const minDim = Math.min(node.width, node.height);
  const isUniform = radii.topLeft === radii.topRight && radii.topRight === radii.bottomLeft && radii.bottomLeft === radii.bottomRight;
  let target = isUniform ? radii.topLeft : (radii.topLeft + radii.topRight + radii.bottomLeft + radii.bottomRight) / 4;

  const ratio = minDim > 0 ? target / minDim : 0;
  if (ratio < RADIUS_NATIVE_TOLERANCE.min) {
    target = 0;
  } else if (ratio > RADIUS_NATIVE_TOLERANCE.max && target < minDim / 2) {
    target = RADIUS_NATIVE_TOLERANCE.max * minDim;
  }

  node.topLeftRadius = target;
  node.topRightRadius = target;
  node.bottomLeftRadius = target;
  node.bottomRightRadius = target;
}

/**
 * Brief — "le focus important est le texte" : substitution de police (par
 * choix manuel de l'utilisateur dans le select "Fonts" de l'UI en priorité,
 * sinon résolution automatique la plus proche disponible dans Slides),
 * tracking remis à 0 (Slides n'a aucun réglage d'espacement des lettres),
 * interligne "auto" explicité à 100 % (Slides n'a pas d'"auto", et c'est sa
 * valeur par défaut), "vertical trim" désactivé (Slides ne le connaît pas,
 * l'espace au-dessus/en-dessous des glyphes n'est jamais rogné).
 */
async function reformatText(node: TextNode, fontOverrides: Record<string, string>): Promise<void> {
  const len = node.characters.length;
  if (len === 0) return;

  const fontSegments = node.getStyledTextSegments(['fontName']);
  const distinctOriginalFonts = new Map<string, FontName>(
    fontSegments.map((s) => [`${s.fontName.family} ${s.fontName.style}`, s.fontName]),
  );
  for (const fontName of distinctOriginalFonts.values()) {
    await tryLoadFont(fontName.family, fontName.style);
  }

  for (const seg of fontSegments) {
    const original = seg.fontName.family;
    const target = fontOverrides[original] ?? resolveFontFamily(original).family;
    if (target === original) continue;
    const style = targetStyleFor(seg.fontName.style);
    const loaded = await tryLoadFont(target, style);
    if (loaded) node.setRangeFontName(seg.start, seg.end, loaded);
  }

  node.setRangeLetterSpacing(0, len, { value: 0, unit: 'PIXELS' });

  if (node.lineHeight === figma.mixed) {
    for (const seg of node.getStyledTextSegments(['lineHeight'])) {
      if (seg.lineHeight.unit === 'AUTO') node.setRangeLineHeight(seg.start, seg.end, { unit: 'PERCENT', value: 100 });
    }
  } else if (node.lineHeight.unit === 'AUTO') {
    node.setRangeLineHeight(0, len, { unit: 'PERCENT', value: 100 });
  }

  if (node.leadingTrim !== 'NONE') {
    node.leadingTrim = 'NONE';
  }
}

function targetStyleFor(originalStyle: string): string {
  const bold = /bold/i.test(originalStyle);
  const italic = /italic/i.test(originalStyle);
  if (bold && italic) return 'Bold Italic';
  if (bold) return 'Bold';
  if (italic) return 'Italic';
  return 'Regular';
}

/** La combinaison famille/style demandée n'existe pas forcément (toutes les polices n'ont pas les 4 variantes) — on retombe sur "Regular" avant d'abandonner. */
async function tryLoadFont(family: string, style: string): Promise<FontName | undefined> {
  try {
    await figma.loadFontAsync({ family, style });
    return { family, style };
  } catch {
    if (style === 'Regular') return undefined;
    try {
      await figma.loadFontAsync({ family, style: 'Regular' });
      return { family, style: 'Regular' };
    } catch {
      return undefined;
    }
  }
}
