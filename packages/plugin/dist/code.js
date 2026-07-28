"use strict";
(() => {
  // src/serialize/ids.ts
  function createIdGenerator(jobId) {
    let seq = 0;
    return () => `f2s_${jobId}_${seq++}`;
  }

  // src/serialize/decisionTree.ts
  var BLEND_MODES_EQUIVALENT_TO_NORMAL = /* @__PURE__ */ new Set(["NORMAL", "PASS_THROUGH"]);
  function classifyNode(input) {
    if (!input.visible) return { action: "ignore" };
    if (input.opacity === 0) return { action: "ignore" };
    if (input.width < 0.5 && input.height < 0.5) return { action: "ignore" };
    if (!BLEND_MODES_EQUIVALENT_TO_NORMAL.has(input.blendMode)) {
      return { action: "raster", warningCode: "BLEND_MODE_RASTERIZED", message: `Mode de fusion \xAB ${input.blendMode} \xBB non support\xE9 par Slides \u2014 converti en image.` };
    }
    if (input.hasVisibleShadowOrBlur) {
      return { action: "raster", warningCode: "EFFECT_RASTERIZED", message: "Ombre port\xE9e ou flou non support\xE9 nativement par Slides \u2014 converti en image." };
    }
    if (input.isMasked) {
      return { action: "raster", warningCode: "MASK_RASTERIZED", message: "Masque de calque non support\xE9 nativement \u2014 le groupe masqu\xE9 est aplati en image." };
    }
    if (input.kind === "LINE") {
      const l = input.line;
      if (!l || l.visibleStrokeCount === 0) return { action: "ignore" };
      if (l.visibleStrokeCount > 1) {
        return { action: "raster", warningCode: "LINE_RASTERIZED", message: "Plusieurs contours sur une ligne \u2014 Slides n'en supporte qu'un seul, convertie en image." };
      }
      if (l.strokeIsGradient) {
        return { action: "raster", warningCode: "GRADIENT_RASTERIZED", message: "D\xE9grad\xE9 sur une ligne non support\xE9 par Slides \u2014 convertie en image." };
      }
      if (l.strokeWeightIsMixed) {
        return { action: "raster", warningCode: "LINE_RASTERIZED", message: "\xC9paisseur de contour non uniforme sur cette ligne \u2014 convertie en image." };
      }
      if (l.hasUnsupportedCap) {
        return { action: "raster", warningCode: "LINE_RASTERIZED", message: "Terminaison de ligne (fl\xE8che, losange, cercle\u2026) non support\xE9e nativement \u2014 convertie en image." };
      }
      return { action: "native-line" };
    }
    if (input.kind === "TEXT") {
      const t = input.text;
      if (t?.fontUnavailable) {
        return { action: "raster", warningCode: "FONT_MISSING", message: "Police introuvable et non substituable \u2014 texte converti en image." };
      }
      if (t?.letterSpacingExceedsThreshold) {
        return { action: "raster", warningCode: "LETTER_SPACING_LOST", message: "L'espacement des lettres modifie la largeur du texte de plus de 2 % \u2014 converti en image." };
      }
      if (t?.hasUnrepresentableMixedStyle) {
        return { action: "raster", warningCode: "EFFECT_RASTERIZED", message: "Style de texte mixte non repr\xE9sentable \u2014 converti en image." };
      }
      return { action: "native-text" };
    }
    if (input.kind === "RECTANGLE" || input.kind === "ELLIPSE" || input.kind === "POLYGON" || input.kind === "STAR") {
      const s = input.shape;
      if (s && s.visibleFillCount > 1) {
        return { action: "raster", warningCode: "MULTIPLE_FILLS_RASTERIZED", message: "Plusieurs remplissages visibles \u2014 Slides ne supporte qu'un seul fill, converti en image." };
      }
      if (s?.fillIsGradient) {
        return { action: "raster", warningCode: "GRADIENT_RASTERIZED", message: "D\xE9grad\xE9 non support\xE9 par Slides \u2014 converti en image." };
      }
      if (s?.fillIsImage) {
        return { action: "image" };
      }
      if (s?.hasMultipleOrOffCenterStroke) {
        return { action: "raster", warningCode: "EFFECT_RASTERIZED", message: "Contour multiple ou non centr\xE9 au-del\xE0 de la tol\xE9rance \u2014 converti en image." };
      }
      if (input.kind === "RECTANGLE" && s?.radiusDecision) {
        const rd = s.radiusDecision;
        if (rd.kind === "raster") {
          return { action: "raster", warningCode: "CORNER_RADIUS_RASTERIZED", message: rd.reason };
        }
        if (rd.kind === "ellipse") return { action: "native-shape-ellipse" };
        if (rd.kind === "round-rectangle") {
          return { action: "native-shape-round-rectangle", approximated: rd.approximated };
        }
      }
      return { action: "native-shape-preset" };
    }
    if (input.kind === "VECTOR_LIKE") {
      return { action: "raster", warningCode: "VECTOR_RASTERIZED", message: "Forme vectorielle custom (ic\xF4ne, op\xE9ration bool\xE9enne, trac\xE9) \u2014 convertie en image." };
    }
    if (input.kind === "GROUP_LIKE") {
      if (input.container?.clipsContentWithOverflow) {
        return { action: "raster", warningCode: "EFFECT_RASTERIZED", message: "Groupe avec recadrage et enfants d\xE9bordants \u2014 aplati en image." };
      }
      return { action: "descend" };
    }
    return { action: "ignore" };
  }

  // src/serialize/radius.ts
  var RADIUS_NATIVE_TOLERANCE = { min: 0.08, max: 0.25 };
  function decideRadius(radii, w, h, tolerance = RADIUS_NATIVE_TOLERANCE) {
    const { topLeft, topRight, bottomLeft, bottomRight } = radii;
    const allZero = topLeft === 0 && topRight === 0 && bottomLeft === 0 && bottomRight === 0;
    if (allZero) return { kind: "rectangle" };
    const uniform = topLeft === topRight && topRight === bottomLeft && bottomLeft === bottomRight;
    if (!uniform) return { kind: "raster", reason: "Rayons de coin non uniformes \u2014 non repr\xE9sentable nativement." };
    const minDim = Math.min(w, h);
    if (topLeft >= minDim / 2) {
      return w === h ? { kind: "ellipse" } : { kind: "round-rectangle", approximated: true };
    }
    const ratio = topLeft / minDim;
    if (ratio >= tolerance.min && ratio <= tolerance.max) {
      return { kind: "round-rectangle", approximated: true };
    }
    return { kind: "raster", reason: `Rapport rayon/min(w,h) = ${ratio.toFixed(3)}, hors tol\xE9rance [${tolerance.min}; ${tolerance.max}].` };
  }

  // src/serialize/fonts.ts
  var GOOGLE_FONTS_SAMPLE = /* @__PURE__ */ new Set([
    "Roboto",
    "Open Sans",
    "Inter",
    "Lato",
    "Montserrat",
    "Poppins",
    "Nunito",
    "Nunito Sans",
    "Source Sans Pro",
    "Raleway",
    "Ubuntu",
    "Merriweather",
    "Playfair Display",
    "PT Sans",
    "Noto Sans",
    "Work Sans",
    "Rubik",
    "Mulish",
    "Karla",
    "Fira Sans",
    "DM Sans",
    "Manrope",
    "Barlow",
    "IBM Plex Sans",
    "Space Grotesk",
    "Oswald",
    "Josefin Sans"
  ]);
  var SLIDES_SYSTEM_FONTS = /* @__PURE__ */ new Set([
    "Arial",
    "Times New Roman",
    "Verdana",
    "Georgia",
    "Courier New",
    "Trebuchet MS",
    "Impact",
    "Comic Sans MS"
  ]);
  var FONT_SUBSTITUTIONS = {
    "SF Pro Text": "Inter",
    "SF Pro Display": "Inter",
    "Helvetica Neue": "Arial",
    Helvetica: "Arial",
    "Segoe UI": "Open Sans",
    S\u00F6hne: "Open Sans",
    "SF Compact": "Inter"
  };
  var SERIF_KEYWORDS = /serif|times|georgia|garamond|didot|playfair|merriweather|book\s?antiqua|cambria|baskerville|caslon|bodoni|crimson|minion|constantia|charter|slab|zilla|lora|noto\s?serif|pt\s?serif|source\s?serif/i;
  var AVAILABLE_FAMILIES = [...GOOGLE_FONTS_SAMPLE, ...SLIDES_SYSTEM_FONTS].sort((a, b) => b.length - a.length);
  var GENERIC_SERIF_FALLBACK = "Times New Roman";
  var GENERIC_SANS_FALLBACK = "Inter";
  function isLikelySerif(family) {
    if (/sans/i.test(family)) return false;
    return SERIF_KEYWORDS.test(family);
  }
  function findNearestAvailableFamily(family) {
    const lower = family.toLowerCase();
    return AVAILABLE_FAMILIES.find((candidate) => lower.includes(candidate.toLowerCase()));
  }
  function resolveFontFamily(family) {
    if (GOOGLE_FONTS_SAMPLE.has(family) || SLIDES_SYSTEM_FONTS.has(family)) {
      return { status: "available", family };
    }
    const substitute = FONT_SUBSTITUTIONS[family];
    if (substitute) {
      return { status: "substituted", family: substitute, original: family };
    }
    const nearest = findNearestAvailableFamily(family);
    if (nearest) {
      return { status: "substituted", family: nearest, original: family };
    }
    const fallback = isLikelySerif(family) ? GENERIC_SERIF_FALLBACK : GENERIC_SANS_FALLBACK;
    return { status: "substituted", family: fallback, original: family };
  }
  var STYLE_WEIGHT_KEYWORDS = [
    [/thin/i, 100],
    [/extra ?light|ultra ?light/i, 200],
    [/light/i, 300],
    [/regular|normal|^book$/i, 400],
    [/medium/i, 500],
    [/semi ?bold|demi ?bold/i, 600],
    [/extra ?bold|ultra ?bold/i, 800],
    [/black|heavy/i, 900],
    [/bold/i, 700]
  ];
  function parseFontWeight(figmaStyle) {
    for (const [re, weight] of STYLE_WEIGHT_KEYWORDS) {
      if (re.test(figmaStyle)) return weight;
    }
    return 400;
  }

  // src/serialize/textMapping.ts
  function mapAlignment(align) {
    switch (align) {
      case "LEFT":
        return "START";
      case "RIGHT":
        return "END";
      case "JUSTIFIED":
        return "JUSTIFIED";
      case "CENTER":
      default:
        return "CENTER";
    }
  }
  function mapVerticalAlignment(align) {
    return align === "CENTER" ? "MIDDLE" : align;
  }
  function applyTextCase(text, textCase) {
    switch (textCase) {
      case "UPPER":
        return text.toUpperCase();
      case "LOWER":
        return text.toLowerCase();
      case "TITLE":
        return text.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
      case "SMALL_CAPS":
      case "ORIGINAL":
      default:
        return text;
    }
  }
  function mapLineSpacing(lineHeight, fontSizePx) {
    if (lineHeight.unit === "AUTO") return void 0;
    if (lineHeight.unit === "PERCENT") return lineHeight.value;
    return lineHeight.value / fontSizePx * 100;
  }
  function letterSpacingImpactRatio(letterSpacingPx, charCount, measuredWidthPx) {
    if (measuredWidthPx <= 0 || charCount <= 1) return 0;
    const deltaWidth = letterSpacingPx * (charCount - 1);
    return Math.abs(deltaWidth) / measuredWidthPx;
  }
  var LETTER_SPACING_RASTER_THRESHOLD = 0.02;
  function normalizeSoftLineBreaks(text) {
    return text.replace(/\u2028/g, "\v");
  }

  // src/serialize/textExtract.ts
  var SEGMENT_FIELDS = [
    "fontSize",
    "fontName",
    "fontWeight",
    "fills",
    "textDecoration",
    "textCase",
    "letterSpacing",
    "lineHeight",
    "hyperlink",
    "listOptions",
    "indentation"
  ];
  function extractTextRuns(node) {
    const segments = node.getStyledTextSegments([...SEGMENT_FIELDS]);
    const runs = [];
    const fontWarnings = [];
    let requiresRaster = false;
    let rasterReason;
    for (const seg of segments) {
      const resolution = resolveFontFamily(seg.fontName.family);
      if (resolution.status === "substituted") {
        fontWarnings.push({ original: resolution.original, substitute: resolution.family });
      }
      const family = resolution.family;
      const width = estimateSegmentWidthPx(seg);
      if (seg.letterSpacing.unit === "PIXELS" && seg.letterSpacing.value !== 0) {
        const impact = letterSpacingImpactRatio(seg.letterSpacing.value, seg.end - seg.start, width);
        if (impact > LETTER_SPACING_RASTER_THRESHOLD) {
          requiresRaster = true;
          rasterReason = `Espacement des lettres modifie la largeur de ${(impact * 100).toFixed(1)} % (> 2%).`;
        }
      }
      runs.push({
        start: seg.start,
        end: seg.end,
        fontFamily: family,
        fontWeight: seg.fontWeight ?? parseFontWeight(seg.fontName.style),
        italic: /italic/i.test(seg.fontName.style),
        fontSizePx: seg.fontSize,
        color: firstSolidFillColor(seg.fills) ?? { r: 0, g: 0, b: 0, a: 1 },
        underline: seg.textDecoration === "UNDERLINE" ? true : void 0,
        strikethrough: seg.textDecoration === "STRIKETHROUGH" ? true : void 0,
        smallCaps: seg.textCase === "SMALL_CAPS" ? true : void 0,
        link: seg.hyperlink && seg.hyperlink.type === "URL" ? seg.hyperlink.value : void 0,
        originalFontFamily: resolution.status === "substituted" ? resolution.original : void 0
      });
    }
    const content = normalizeSoftLineBreaks(
      segments.map((seg) => applyTextCase(node.characters.slice(seg.start, seg.end), seg.textCase)).join("")
    );
    const paragraphs = buildParagraphs(node, segments);
    return { content, runs, paragraphs, requiresRaster, rasterReason, fontWarnings };
  }
  function buildParagraphs(node, segments) {
    const paragraphs = [];
    const text = node.characters;
    let start = 0;
    for (let i = 0; i <= text.length; i++) {
      if (i === text.length || text[i] === "\n") {
        const isNewline = i < text.length;
        let end = i;
        if (start === end) {
          if (!isNewline) {
            start = i + 1;
            continue;
          }
          end = start + 1;
        }
        const coveringSegment = segments.find((s) => s.start <= start && start < s.end) ?? segments[segments.length - 1];
        const align = typeof node.textAlignHorizontal === "string" ? node.textAlignHorizontal : "LEFT";
        paragraphs.push({
          start,
          end,
          align: mapAlignment(align),
          lineSpacingPct: coveringSegment ? mapLineSpacing(coveringSegment.lineHeight, coveringSegment.fontSize) : void 0,
          indentStartPt: coveringSegment?.indentation || void 0,
          bullet: coveringSegment?.listOptions?.type === "ORDERED" ? "ORDERED" : coveringSegment?.listOptions?.type === "UNORDERED" ? "UNORDERED" : void 0
        });
        start = i + 1;
      }
    }
    return paragraphs;
  }
  function firstSolidFillColor(fills) {
    if (fills === figma.mixed || !Array.isArray(fills)) return void 0;
    const solid = fills.find((f) => f.type === "SOLID" && f.visible !== false);
    if (!solid) return void 0;
    return { r: solid.color.r, g: solid.color.g, b: solid.color.b, a: solid.opacity ?? 1 };
  }
  function estimateSegmentWidthPx(seg) {
    const avgCharWidthRatio = 0.55;
    return seg.fontSize * avgCharWidthRatio * (seg.end - seg.start);
  }

  // src/serialize/stroke.ts
  var STROKE_OFFCENTER_TOLERANCE_PT = 0.5;
  function shouldRasterForStroke(input) {
    if (input.visibleStrokeCount === 0) return false;
    if (input.visibleStrokeCount > 1) return true;
    if (input.weightIsMixed) return true;
    if (input.align === "CENTER") return false;
    const deviation = input.weight / 2;
    return deviation > STROKE_OFFCENTER_TOLERANCE_PT;
  }

  // src/serialize/serializeFrame.ts
  function evaluateStroke(node) {
    if (!("strokes" in node)) return false;
    const visibleStrokeCount = node.strokes.filter((s) => s.visible !== false).length;
    const weight = "strokeWeight" in node ? node.strokeWeight : 0;
    const align = "strokeAlign" in node ? node.strokeAlign : "CENTER";
    return shouldRasterForStroke({
      visibleStrokeCount,
      weightIsMixed: weight === figma.mixed,
      weight: weight === figma.mixed ? 0 : weight,
      align
    });
  }
  async function serializeFrame(frame, ctx) {
    const elements = [];
    const warnings = [];
    const nodesToRaster = /* @__PURE__ */ new Map();
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
        warnings
      },
      nodesToRaster
    };
  }
  async function walk(node, state) {
    const decision = classifyNode(toDecisionInput(node, state.maskedByAncestor ?? false));
    switch (decision.action) {
      case "ignore":
        return;
      case "raster": {
        const id = state.ctx.nextId();
        pushRasterPlaceholder(node, id, state);
        state.nodesToRaster.set(id, [node]);
        state.warnings.push({
          code: decision.warningCode,
          severity: decision.warningCode === "FONT_MISSING" ? "blocking" : "warning",
          sourceNodeId: node.id,
          nodeName: node.name,
          message: decision.message
        });
        return;
      }
      case "image": {
        const id = state.ctx.nextId();
        state.elements.push(buildImagePlaceholder(node, id, state, false));
        state.nodesToRaster.set(id, [node]);
        return;
      }
      case "native-text": {
        const textNode = node;
        const extraction = extractTextRuns(textNode);
        if (extraction.requiresRaster) {
          const id = state.ctx.nextId();
          pushRasterPlaceholder(node, id, state);
          state.nodesToRaster.set(id, [node]);
          state.warnings.push({
            code: "LETTER_SPACING_LOST",
            severity: "warning",
            sourceNodeId: node.id,
            nodeName: node.name,
            message: extraction.rasterReason ?? "Texte converti en image."
          });
          return;
        }
        for (const w of extraction.fontWarnings) {
          if (w.substitute) {
            state.warnings.push({
              code: "FONT_SUBSTITUTED",
              severity: "info",
              sourceNodeId: node.id,
              nodeName: node.name,
              message: `Police \xAB ${w.original} \xBB remplac\xE9e par \xAB ${w.substitute} \xBB.`
            });
          }
        }
        const rel = relativeRect(node, state);
        state.elements.push({
          kind: "text",
          id: state.ctx.nextId(),
          sourceNodeId: node.id,
          rect: rel,
          rotation: "rotation" in node ? node.rotation : 0,
          opacity: "opacity" in node ? node.opacity : 1,
          content: extraction.content,
          runs: extraction.runs,
          paragraphs: extraction.paragraphs,
          vAlign: mapVerticalAlignment(textNode.textAlignVertical ?? "TOP")
        });
        return;
      }
      case "native-shape-preset":
      case "native-shape-ellipse":
      case "native-shape-round-rectangle": {
        const shape = buildNativeShape(node, decision.action, state);
        state.elements.push(shape);
        if (decision.action === "native-shape-round-rectangle" && decision.approximated) {
          state.warnings.push({
            code: "RADIUS_APPROXIMATED",
            severity: "info",
            sourceNodeId: node.id,
            nodeName: node.name,
            message: "Le rayon de coin est approxim\xE9 par Slides (valeur fixe non param\xE9trable)."
          });
        }
        return;
      }
      case "native-line": {
        state.elements.push(buildNativeLine(node, state));
        return;
      }
      case "descend": {
        const container = node;
        for (const child of container.children) {
          await walk(child, { ...state, maskedByAncestor: state.maskedByAncestor });
        }
        return;
      }
    }
  }
  function toDecisionInput(node, maskedByAncestor) {
    const kind = nodeKind(node);
    const visible = "visible" in node ? node.visible : true;
    const opacity = "opacity" in node ? node.opacity : 1;
    const width = "width" in node ? node.width : 0;
    const height = "height" in node ? node.height : 0;
    const blendMode = "blendMode" in node ? node.blendMode : "NORMAL";
    const isMask = "isMask" in node ? Boolean(node.isMask) : false;
    const input = {
      kind,
      visible,
      opacity,
      width,
      height,
      blendMode,
      hasVisibleShadowOrBlur: hasVisibleShadowOrBlur(node),
      isMasked: isMask || maskedByAncestor
    };
    if (kind === "TEXT") {
      input.text = { fontUnavailable: false, letterSpacingExceedsThreshold: false, hasUnrepresentableMixedStyle: false };
    }
    if (kind === "RECTANGLE" || kind === "ELLIPSE" || kind === "POLYGON" || kind === "STAR") {
      input.shape = shapeInfo(node, kind);
    }
    if (kind === "LINE") {
      input.line = lineInfo(node);
    }
    if (kind === "GROUP_LIKE") {
      const clipsContent = "clipsContent" in node ? Boolean(node.clipsContent) : false;
      input.container = { clipsContentWithOverflow: clipsContent && childrenOverflow(node) };
    }
    return input;
  }
  function nodeKind(node) {
    switch (node.type) {
      case "TEXT":
        return "TEXT";
      case "RECTANGLE":
        return "RECTANGLE";
      case "ELLIPSE":
        return "ELLIPSE";
      case "LINE":
        return "LINE";
      case "POLYGON":
        return "POLYGON";
      case "STAR":
        return "STAR";
      case "VECTOR":
      case "BOOLEAN_OPERATION":
        return "VECTOR_LIKE";
      case "GROUP":
      case "FRAME":
      case "COMPONENT":
      case "INSTANCE":
        return "GROUP_LIKE";
      default:
        return "OTHER";
    }
  }
  function hasVisibleShadowOrBlur(node) {
    if (!("effects" in node)) return false;
    return node.effects.some((e) => e.visible && (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW" || e.type === "LAYER_BLUR" || e.type === "BACKGROUND_BLUR"));
  }
  function childrenOverflow(frame) {
    return frame.children.some((c) => {
      const box = c.absoluteBoundingBox;
      const parentBox = frame.absoluteBoundingBox;
      if (!box || !parentBox) return false;
      return box.x < parentBox.x || box.y < parentBox.y || box.x + box.width > parentBox.x + parentBox.width || box.y + box.height > parentBox.y + parentBox.height;
    });
  }
  function shapeInfo(node, kind) {
    const fills = "fills" in node && node.fills !== figma.mixed ? node.fills : [];
    const visibleFills = fills.filter((f) => f.visible !== false);
    const fillIsGradient = visibleFills.some((f) => f.type.startsWith("GRADIENT"));
    const fillIsImage = visibleFills.length === 1 && visibleFills[0].type === "IMAGE";
    const hasMultipleOrOffCenterStroke = evaluateStroke(node);
    let radiusDecision;
    if (kind === "RECTANGLE" && "topLeftRadius" in node) {
      radiusDecision = decideRadius(
        {
          topLeft: node.topLeftRadius,
          topRight: node.topRightRadius,
          bottomLeft: node.bottomLeftRadius,
          bottomRight: node.bottomRightRadius
        },
        node.width,
        node.height
      );
    }
    return { visibleFillCount: visibleFills.length, fillIsGradient, fillIsImage, hasMultipleOrOffCenterStroke, radiusDecision };
  }
  var SUPPORTED_LINE_CAPS = /* @__PURE__ */ new Set(["NONE", "ROUND", "SQUARE"]);
  function lineInfo(node) {
    const strokes = "strokes" in node ? node.strokes.filter((s) => s.visible !== false) : [];
    const strokeIsGradient = strokes.some((s) => s.type.startsWith("GRADIENT"));
    const weight = "strokeWeight" in node ? node.strokeWeight : 0;
    const strokeWeightIsMixed = weight === figma.mixed;
    const cap = "strokeCap" in node ? node.strokeCap : "NONE";
    const hasUnsupportedCap = cap === figma.mixed || cap === void 0 || !SUPPORTED_LINE_CAPS.has(cap);
    return { visibleStrokeCount: strokes.length, strokeIsGradient, strokeWeightIsMixed, hasUnsupportedCap };
  }
  function relativeRect(node, state) {
    const rotation = "rotation" in node ? node.rotation : 0;
    if (rotation !== 0 && "width" in node && "height" in node) {
      const [[, , tx], [, , ty]] = node.absoluteTransform;
      return { x: tx - state.rootX, y: ty - state.rootY, w: node.width, h: node.height };
    }
    const box = node.absoluteBoundingBox;
    if (!box) return { x: 0, y: 0, w: "width" in node ? node.width : 0, h: "height" in node ? node.height : 0 };
    return { x: box.x - state.rootX, y: box.y - state.rootY, w: box.width, h: box.height };
  }
  function relativeRenderRect(node, state) {
    const renderBounds = "absoluteRenderBounds" in node ? node.absoluteRenderBounds : null;
    const box = renderBounds ?? node.absoluteBoundingBox;
    if (!box) return { x: 0, y: 0, w: "width" in node ? node.width : 0, h: "height" in node ? node.height : 0 };
    return { x: box.x - state.rootX, y: box.y - state.rootY, w: box.width, h: box.height };
  }
  function buildNativeShape(node, action, state) {
    const rel = relativeRect(node, state);
    const fills = "fills" in node && node.fills !== figma.mixed ? node.fills : [];
    const solidFill = fills.find((f) => f.type === "SOLID" && f.visible !== false);
    const fill = solidFill ? { type: "SOLID", color: { r: solidFill.color.r, g: solidFill.color.g, b: solidFill.color.b, a: solidFill.opacity ?? 1 } } : void 0;
    const strokes = "strokes" in node ? node.strokes.filter((s) => s.visible !== false) : [];
    const strokeSolid = strokes.find((s) => s.type === "SOLID");
    const strokeWeight = "strokeWeight" in node && typeof node.strokeWeight === "number" ? node.strokeWeight : 0;
    const stroke = strokeSolid && strokeWeight > 0 ? { color: { r: strokeSolid.color.r, g: strokeSolid.color.g, b: strokeSolid.color.b, a: strokeSolid.opacity ?? 1 }, weightPt: strokeWeight, dash: dashStyleOf(node) } : void 0;
    const shapeType = action === "native-shape-ellipse" ? "ELLIPSE" : action === "native-shape-round-rectangle" ? "ROUND_RECTANGLE" : presetShapeType(node);
    return {
      kind: "shape",
      id: state.ctx.nextId(),
      sourceNodeId: node.id,
      rect: rel,
      rotation: "rotation" in node ? node.rotation : 0,
      opacity: "opacity" in node ? node.opacity : 1,
      shapeType,
      fill,
      stroke
    };
  }
  function buildNativeLine(node, state) {
    const rel = relativeRect(node, state);
    const strokes = "strokes" in node ? node.strokes.filter((s) => s.visible !== false) : [];
    const strokeSolid = strokes.find((s) => s.type === "SOLID");
    const strokeWeight = "strokeWeight" in node && typeof node.strokeWeight === "number" ? node.strokeWeight : 1;
    return {
      kind: "line",
      id: state.ctx.nextId(),
      sourceNodeId: node.id,
      rect: rel,
      rotation: "rotation" in node ? node.rotation : 0,
      opacity: "opacity" in node ? node.opacity : 1,
      stroke: {
        color: strokeSolid ? { r: strokeSolid.color.r, g: strokeSolid.color.g, b: strokeSolid.color.b, a: strokeSolid.opacity ?? 1 } : { r: 0, g: 0, b: 0, a: 1 },
        weightPt: strokeWeight,
        dash: dashStyleOf(node)
      }
    };
  }
  function dashStyleOf(node) {
    if ("dashPattern" in node && node.dashPattern.length > 0) {
      return node.dashPattern[0] > 4 ? "DASH" : "DOT";
    }
    return "SOLID";
  }
  function presetShapeType(node) {
    switch (node.type) {
      case "ELLIPSE":
        return "ELLIPSE";
      case "STAR":
        return "STAR_5";
      case "POLYGON":
        return "HEXAGON";
      // approximation raisonnable ; à affiner par nombre de côtés réel
      default:
        return "RECTANGLE";
    }
  }
  function buildImagePlaceholder(node, id, state, isRasterFallback) {
    const rel = relativeRenderRect(node, state);
    return {
      kind: "image",
      id,
      sourceNodeId: node.id,
      rect: rel,
      // `node.exportAsync` (code.ts) rend le nœud tel qu'affiché — la
      // rotation est donc déjà "cuite" dans les pixels du PNG exporté (dont
      // les dimensions correspondent à `relativeRenderRect`, l'AABB post-
      // rotation). Réappliquer `node.rotation` ici tournerait cette image
      // déjà orientée une seconde fois.
      rotation: 0,
      opacity: "opacity" in node ? node.opacity : 1,
      assetKey: id,
      isRasterFallback,
      rasterizedNodeIds: isRasterFallback ? [node.id] : void 0
    };
  }
  function pushRasterPlaceholder(node, id, state) {
    state.elements.push(buildImagePlaceholder(node, id, state, true));
  }
  function uniformFrameBackground(frame) {
    const fills = frame.fills !== figma.mixed ? frame.fills : [];
    const visible = fills.filter((f2) => f2.visible !== false);
    if (visible.length !== 1 || visible[0].type !== "SOLID") return void 0;
    const f = visible[0];
    return { type: "SOLID", color: { r: f.color.r, g: f.color.g, b: f.color.b, a: f.opacity ?? 1 } };
  }

  // src/code.ts
  var MAX_FRAMES_WARNING = 20;
  var PREVIEW_WIDTH = 320;
  function isExportable(node) {
    return node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE";
  }
  function collectCandidateFrames() {
    const selection = figma.currentPage.selection.filter((n) => n.parent?.type === "PAGE");
    const source = selection.length > 0 ? selection : figma.currentPage.children;
    const included = [];
    const excluded = [];
    for (const node of source) {
      if (isExportable(node)) {
        included.push(node);
      } else {
        excluded.push({ name: node.name, reason: `Type non exportable : ${node.type}` });
      }
    }
    return { included, excluded };
  }
  function yieldToUi() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
  async function generatePreview(node) {
    const bytes = await node.exportAsync({ format: "PNG", constraint: { type: "WIDTH", value: PREVIEW_WIDTH } });
    return `data:image/png;base64,${figma.base64Encode(bytes)}`;
  }
  async function main() {
    figma.showUI(__html__, { width: 480, height: 640 });
    const { included, excluded } = collectCandidateFrames();
    figma.ui.postMessage({ type: "candidates", frames: included.map((f) => ({ id: f.id, name: f.name, width: f.width, height: f.height })), excluded });
    if (included.length > MAX_FRAMES_WARNING) {
      figma.ui.postMessage({ type: "too-many-frames", count: included.length, max: MAX_FRAMES_WARNING });
    }
    const pending = [];
    const idGen = createIdGenerator(figma.root.id.slice(0, 8));
    for (const frame of included) {
      const previewDataUrl = await generatePreview(frame);
      figma.ui.postMessage({ type: "preview", frameId: frame.id, previewDataUrl });
      await yieldToUi();
      const { slide, nodesToRaster } = await serializeFrame(frame, { nextId: idGen });
      pending.push({ frame, slide, nodesToRaster });
      const nativeCount = slide.elements.filter((e) => e.kind !== "image" || !e.isRasterFallback).length;
      const rasterCount = slide.elements.length - nativeCount;
      figma.ui.postMessage({
        type: "analysis",
        frameId: frame.id,
        nativeCount,
        rasterCount,
        warnings: slide.warnings
      });
      await yieldToUi();
    }
    figma.ui.onmessage = async (msg) => {
      if (msg.type === "select-nodes") {
        const ids = msg.nodeIds;
        const resolved = await Promise.all(ids.map((id) => figma.getNodeByIdAsync(id)));
        const nodes = resolved.filter((n) => n !== null && "x" in n);
        figma.currentPage.selection = nodes;
        figma.viewport.scrollAndZoomIntoView(nodes);
        return;
      }
      if (msg.type === "request-export") {
        try {
          await handleExportRequest(
            msg,
            pending
          );
        } catch (err) {
          console.error(err);
          figma.ui.postMessage({ type: "export-error", message: err.message });
        }
      }
    };
  }
  var REFERENCE_SIDE_PT = 720;
  function computeSlideSizePt(frameSize) {
    if (!frameSize || frameSize.width <= 0 || frameSize.height <= 0) {
      return { widthPt: REFERENCE_SIDE_PT, heightPt: REFERENCE_SIDE_PT * (9 / 16) };
    }
    const { width, height } = frameSize;
    return width >= height ? { widthPt: REFERENCE_SIDE_PT, heightPt: REFERENCE_SIDE_PT * (height / width) } : { widthPt: REFERENCE_SIDE_PT * (width / height), heightPt: REFERENCE_SIDE_PT };
  }
  async function handleExportRequest(msg, pending) {
    const byId = new Map(pending.map((p) => [p.frame.id, p]));
    const orderedIds = msg.order.filter((id) => msg.includedFrameIds.includes(id));
    const slides = [];
    const assets = [];
    for (let i = 0; i < orderedIds.length; i++) {
      const p = byId.get(orderedIds[i]);
      if (!p) continue;
      for (const [assetKey, nodes] of p.nodesToRaster) {
        const node = nodes[0];
        const scaleConstraint = { type: "SCALE", value: msg.options.rasterScale };
        try {
          const bytes = await node.exportAsync({ format: "PNG", constraint: scaleConstraint });
          assets.push({ assetKey, bytes, mimeType: "image/png" });
        } catch (err) {
          console.error(`[export] \xE9chec de rasterisation pour ${node.name} (${node.id})`, err);
        }
        await yieldToUi();
      }
      slides.push({ ...p.slide, order: i, previewDataUrl: "" });
    }
    const doc = {
      version: 1,
      presentationTitle: msg.presentationTitle,
      slideSize: computeSlideSizePt(slides[0]?.frameSize),
      slides,
      options: msg.options
    };
    figma.ui.postMessage({
      type: "export-payload",
      document: doc,
      assets: assets.map((a) => ({ assetKey: a.assetKey, mimeType: a.mimeType }))
    });
    for (const asset of assets) {
      figma.ui.postMessage({ type: "export-asset", assetKey: asset.assetKey, bytes: asset.bytes.buffer });
    }
  }
  main().catch((err) => {
    console.error(err);
    figma.notify(`Erreur d'export : ${err.message}`, { error: true });
  });
})();
