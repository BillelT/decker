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
      return { action: "raster", warningCode: "BLEND_MODE_RASTERIZED", message: `Blend mode "${input.blendMode}" isn't supported by Slides \u2014 converted to an image.` };
    }
    if (input.hasVisibleShadowOrBlur) {
      return { action: "raster", warningCode: "EFFECT_RASTERIZED", message: "Drop shadow or blur has no native Slides equivalent \u2014 converted to an image." };
    }
    if (input.isMasked) {
      return { action: "raster", warningCode: "MASK_RASTERIZED", message: "Layer masks have no native Slides equivalent \u2014 the masked group is flattened into an image." };
    }
    if (input.kind === "LINE") {
      const l = input.line;
      if (!l || l.visibleStrokeCount === 0) return { action: "ignore" };
      if (l.visibleStrokeCount > 1) {
        return { action: "raster", warningCode: "LINE_RASTERIZED", message: "Multiple strokes on a line \u2014 Slides supports only one, converted to an image." };
      }
      if (l.strokeIsGradient) {
        return { action: "raster", warningCode: "GRADIENT_RASTERIZED", message: "Gradient stroke on a line is not supported by Slides \u2014 converted to an image." };
      }
      if (l.strokeWeightIsMixed) {
        return { action: "raster", warningCode: "LINE_RASTERIZED", message: "Non-uniform stroke weight on this line \u2014 converted to an image." };
      }
      if (l.hasUnsupportedCap) {
        return { action: "raster", warningCode: "LINE_RASTERIZED", message: "Decorative line cap (arrow, diamond, circle\u2026) has no native Slides equivalent \u2014 converted to an image." };
      }
      return { action: "native-line" };
    }
    if (input.kind === "TEXT") {
      const t = input.text;
      if (t?.fontUnavailable) {
        return { action: "raster", warningCode: "FONT_MISSING", message: "Font not found and no substitute available \u2014 text converted to an image." };
      }
      if (t?.letterSpacingExceedsThreshold) {
        return { action: "raster", warningCode: "LETTER_SPACING_LOST", message: "Letter spacing changes the text width by more than 2% \u2014 converted to an image." };
      }
      if (t?.hasUnrepresentableMixedStyle) {
        return { action: "raster", warningCode: "EFFECT_RASTERIZED", message: "Mixed text styling cannot be represented \u2014 converted to an image." };
      }
      return { action: "native-text" };
    }
    if (input.kind === "RECTANGLE" || input.kind === "ELLIPSE" || input.kind === "POLYGON" || input.kind === "STAR") {
      const s = input.shape;
      if (s && s.visibleFillCount > 1) {
        return { action: "raster", warningCode: "MULTIPLE_FILLS_RASTERIZED", message: "Multiple visible fills \u2014 Slides supports only one, converted to an image." };
      }
      if (s?.fillIsGradient) {
        return { action: "raster", warningCode: "GRADIENT_RASTERIZED", message: "Gradients are not supported by Slides \u2014 converted to an image." };
      }
      if (s?.fillIsImage) {
        return { action: "image" };
      }
      if (s?.hasMultipleOrOffCenterStroke) {
        return { action: "raster", warningCode: "EFFECT_RASTERIZED", message: "Multiple or off-center stroke beyond tolerance \u2014 converted to an image." };
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
      return { action: "raster", warningCode: "VECTOR_RASTERIZED", message: "Custom vector shape (icon, boolean operation, path) \u2014 converted to an image." };
    }
    if (input.kind === "GROUP_LIKE") {
      if (input.container?.clipsContentWithOverflow) {
        return { action: "raster", warningCode: "EFFECT_RASTERIZED", message: "Group clips overflowing children \u2014 flattened into an image." };
      }
      const bg = input.container?.fill;
      if (bg && bg.visibleFillCount > 0) {
        if (bg.visibleFillCount > 1 || bg.fillIsGradient || bg.fillIsImage || bg.hasMultipleOrOffCenterStroke) {
          return {
            action: "raster",
            warningCode: "CONTAINER_BACKGROUND_RASTERIZED",
            message: "This layout frame's own background (gradient, image fill, multiple fills, or non-standard stroke) can't be combined natively with its children \u2014 the whole group is converted to an image."
          };
        }
        if (bg.radiusDecision) {
          const rd = bg.radiusDecision;
          if (rd.kind === "raster") {
            return { action: "raster", warningCode: "CORNER_RADIUS_RASTERIZED", message: rd.reason };
          }
          if (rd.kind === "ellipse") return { action: "descend", background: { action: "native-shape-ellipse" } };
          if (rd.kind === "round-rectangle") {
            return { action: "descend", background: { action: "native-shape-round-rectangle", approximated: rd.approximated } };
          }
        }
        return { action: "descend", background: { action: "native-shape-preset" } };
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
    if (!uniform) return { kind: "raster", reason: "Corner radii differ between corners \u2014 not representable natively." };
    const minDim = Math.min(w, h);
    if (topLeft >= minDim / 2) {
      return w === h ? { kind: "ellipse" } : { kind: "round-rectangle", approximated: true };
    }
    const ratio = topLeft / minDim;
    if (ratio >= tolerance.min && ratio <= tolerance.max) {
      return { kind: "round-rectangle", approximated: true };
    }
    return { kind: "raster", reason: `Corner radius ratio ${ratio.toFixed(3)} of min(w,h) is outside the supported range [${tolerance.min}; ${tolerance.max}].` };
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
  var AVAILABLE_SLIDES_FONTS = [...GOOGLE_FONTS_SAMPLE, ...SLIDES_SYSTEM_FONTS].sort((a, b) => a.localeCompare(b));
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
          rasterReason = `Letter spacing changes the text width by ${(impact * 100).toFixed(1)}% (> 2%).`;
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

  // src/serialize/placeholder.ts
  var TAG_PATTERN = /^\s*\[\[\s*([a-zA-Z]+)\s*(?::\s*([^\]]+))?\]\]/;
  var ROLE_ALIASES = {
    title: "TITLE",
    titre: "TITLE",
    heading: "TITLE",
    subtitle: "SUBTITLE",
    soustitre: "SUBTITLE",
    body: "BODY",
    texte: "BODY",
    corps: "BODY",
    text: "BODY",
    image: "IMAGE",
    photo: "IMAGE",
    picture: "IMAGE",
    logo: "LOGO",
    custom: "CUSTOM"
  };
  function defaultLabel(role) {
    switch (role) {
      case "TITLE":
        return "Title";
      case "SUBTITLE":
        return "Subtitle";
      case "BODY":
        return "Body text";
      case "IMAGE":
        return "Image";
      case "LOGO":
        return "Logo";
      case "CUSTOM":
        return "Custom placeholder";
    }
  }
  function parsePlaceholderTag(layerName) {
    const match = TAG_PATTERN.exec(layerName);
    if (!match) return void 0;
    const role = ROLE_ALIASES[match[1].toLowerCase()];
    if (!role) return void 0;
    const label = match[2]?.trim();
    return { role, label: label && label.length > 0 ? label : defaultLabel(role) };
  }
  function findUnknownPlaceholderTag(layerName) {
    const match = TAG_PATTERN.exec(layerName);
    if (!match) return void 0;
    return ROLE_ALIASES[match[1].toLowerCase()] ? void 0 : match[1];
  }
  var KNOWN_ROLE_TAGS = ["title", "subtitle", "body", "image", "logo", "custom"];

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
    const unknownTag = findUnknownPlaceholderTag(node.name);
    if (unknownTag) {
      state.warnings.push({
        code: "PLACEHOLDER_TAG_UNKNOWN",
        severity: "warning",
        sourceNodeId: node.id,
        nodeName: node.name,
        message: `Unknown placeholder tag "[[${unknownTag}]]" \u2014 use one of: ${KNOWN_ROLE_TAGS.map((r) => `[[${r}]]`).join(", ")}.`
      });
    }
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
            message: extraction.rasterReason ?? "Text converted to an image."
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
              message: `Font "${w.original}" replaced with "${w.substitute}".`
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
          vAlign: mapVerticalAlignment(textNode.textAlignVertical ?? "TOP"),
          tightFit: textNode.textAutoResize === "WIDTH_AND_HEIGHT",
          placeholder: parsePlaceholderTag(node.name)
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
            message: "Corner radius is approximated by Slides (fixed, non-adjustable value)."
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
        if (decision.background) {
          state.elements.push(buildNativeShape(node, decision.background.action, state));
          if (decision.background.action === "native-shape-round-rectangle" && decision.background.approximated) {
            state.warnings.push({
              code: "RADIUS_APPROXIMATED",
              severity: "info",
              sourceNodeId: node.id,
              nodeName: node.name,
              message: "Corner radius is approximated by Slides (fixed, non-adjustable value)."
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
      input.container = {
        clipsContentWithOverflow: clipsContent && childrenOverflow(node),
        // Un GROUP (contrairement à FRAME/COMPONENT/INSTANCE) n'a pas de `fills` — pas de fond propre possible.
        fill: "fills" in node ? shapeInfo(node, "GROUP_LIKE") : void 0
      };
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
    if ((kind === "RECTANGLE" || kind === "GROUP_LIKE") && "topLeftRadius" in node) {
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
    const box = node.absoluteBoundingBox;
    if (!box) return { x: 0, y: 0, w: "width" in node ? node.width : 0, h: "height" in node ? node.height : 0 };
    if (rotation !== 0 && "width" in node && "height" in node) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      return { x: cx - node.width / 2 - state.rootX, y: cy - node.height / 2 - state.rootY, w: node.width, h: node.height };
    }
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
      stroke,
      placeholder: parsePlaceholderTag(node.name)
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
      },
      placeholder: parsePlaceholderTag(node.name)
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
      rasterizedNodeIds: isRasterFallback ? [node.id] : void 0,
      // Un raster fallback n'est jamais éditable : le tag est quand même
      // conservé (utile pour le rapport de template et signale au créateur
      // *quel* placeholder prévu a fini rasterisé), mais `templateValidation`
      // bloque de toute façon l'export tant qu'il subsiste.
      placeholder: parsePlaceholderTag(node.name)
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

  // src/serialize/lintFrame.ts
  async function lintFrame(frame) {
    const warnings = [];
    for (const child of frame.children) {
      await walk2(child, warnings, false);
    }
    return warnings;
  }
  async function walk2(node, warnings, maskedByAncestor) {
    const decision = classifyNode(toDecisionInput(node, maskedByAncestor));
    switch (decision.action) {
      case "raster":
        warnings.push({ nodeId: node.id, nodeName: node.name, code: decision.warningCode, message: decision.message, category: "rasterized" });
        return;
      case "native-text": {
        const extraction = extractTextRuns(node);
        if (extraction.requiresRaster) {
          warnings.push({
            nodeId: node.id,
            nodeName: node.name,
            code: "LETTER_SPACING_LOST",
            message: extraction.rasterReason ?? "Text cannot be represented \u2014 it will be converted to an image.",
            category: "rasterized"
          });
          return;
        }
        for (const w of extraction.fontWarnings) {
          if (!w.substitute) continue;
          warnings.push({
            nodeId: node.id,
            nodeName: node.name,
            code: "FONT_SUBSTITUTED",
            message: `Font "${w.original}" replaced with "${w.substitute}" \u2014 text may look different.`,
            category: "visual-diff"
          });
        }
        return;
      }
      case "native-shape-round-rectangle":
        if (decision.approximated) {
          warnings.push({
            nodeId: node.id,
            nodeName: node.name,
            code: "RADIUS_APPROXIMATED",
            message: "Corner radius is approximated by Slides (fixed, non-adjustable value).",
            category: "visual-diff"
          });
        }
        return;
      case "descend": {
        if (decision.background?.action === "native-shape-round-rectangle" && decision.background.approximated) {
          warnings.push({
            nodeId: node.id,
            nodeName: node.name,
            code: "RADIUS_APPROXIMATED",
            message: "Corner radius is approximated by Slides (fixed, non-adjustable value).",
            category: "visual-diff"
          });
        }
        const container = node;
        for (const child of container.children) {
          await walk2(child, warnings, maskedByAncestor);
        }
        return;
      }
      default:
        return;
    }
  }

  // src/serialize/reformatForSlides.ts
  var NATIVE_SHAPE_TYPES = /* @__PURE__ */ new Set(["RECTANGLE", "ELLIPSE", "POLYGON", "STAR"]);
  async function reformatForSlides(root, fontOverrides) {
    flattenFills(root);
    for (const child of root.children) {
      await walk3(child, fontOverrides);
    }
  }
  async function walk3(node, fontOverrides) {
    if ("visible" in node && !node.visible) return;
    stripUnsupportedEffects(node);
    if (node.type === "TEXT") {
      await reformatText(node, fontOverrides);
      return;
    }
    if (NATIVE_SHAPE_TYPES.has(node.type)) {
      flattenFills(node);
      flattenStroke(node);
      if (node.type === "RECTANGLE") normalizeCornerRadius(node);
    } else if (node.type === "LINE") {
      flattenStroke(node);
      normalizeLineCap(node);
    }
    if ("children" in node) {
      for (const child of node.children) await walk3(child, fontOverrides);
    }
  }
  function flattenFills(node) {
    if (!("fills" in node) || node.fills === figma.mixed) return;
    const fills = node.fills;
    const visible = fills.filter((f) => f.visible !== false);
    if (visible.length === 0) return;
    if (visible.length === 1 && (visible[0].type === "SOLID" || visible[0].type === "IMAGE")) return;
    if (visible.some((f) => f.type === "IMAGE")) return;
    const solid = representativeSolidColor(visible);
    if (solid) node.fills = [solid];
  }
  function flattenStroke(node) {
    if (!("strokes" in node)) return;
    const strokes = node.strokes.filter((s) => s.visible !== false);
    if (strokes.length > 0) {
      const alreadySingleSolid = strokes.length === 1 && strokes[0].type === "SOLID";
      if (!alreadySingleSolid) {
        const solid = representativeSolidColor(strokes);
        if (solid) node.strokes = [solid];
      }
      if ("strokeAlign" in node) node.strokeAlign = "CENTER";
      normalizeStrokeWeight(node);
    }
  }
  function representativeSolidColor(paints) {
    for (let i = paints.length - 1; i >= 0; i--) {
      const p = paints[i];
      if (p.type === "SOLID") return { type: "SOLID", color: p.color, opacity: p.opacity ?? 1 };
    }
    for (let i = paints.length - 1; i >= 0; i--) {
      const p = paints[i];
      if (p.type.startsWith("GRADIENT")) {
        const stop = p.gradientStops[0];
        if (stop) {
          return { type: "SOLID", color: { r: stop.color.r, g: stop.color.g, b: stop.color.b }, opacity: stop.color.a * (p.opacity ?? 1) };
        }
      }
    }
    return void 0;
  }
  function normalizeStrokeWeight(node) {
    if (!("strokeWeight" in node) || node.strokeWeight !== figma.mixed) return;
    const sideKeys = ["strokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"];
    const values = sideKeys.filter((k) => k in node).map((k) => node[k]);
    if (values.length === 0) return;
    node.strokeWeight = values.reduce((a, b) => a + b, 0) / values.length;
  }
  function stripUnsupportedEffects(node) {
    if (!("effects" in node) || node.effects.length === 0) return;
    const kept = node.effects.filter((e) => !(e.visible && (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW" || e.type === "LAYER_BLUR" || e.type === "BACKGROUND_BLUR")));
    if (kept.length !== node.effects.length) node.effects = kept;
  }
  function normalizeLineCap(node) {
    const cap = node.strokeCap;
    if (cap === figma.mixed || !SUPPORTED_LINE_CAPS.has(cap)) {
      node.strokeCap = "NONE";
    }
  }
  function normalizeCornerRadius(node) {
    const radii = {
      topLeft: node.topLeftRadius,
      topRight: node.topRightRadius,
      bottomLeft: node.bottomLeftRadius,
      bottomRight: node.bottomRightRadius
    };
    const decision = decideRadius(radii, node.width, node.height);
    if (decision.kind !== "raster") return;
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
  async function reformatText(node, fontOverrides) {
    const len = node.characters.length;
    if (len === 0) return;
    const fontSegments = node.getStyledTextSegments(["fontName"]);
    const distinctOriginalFonts = new Map(
      fontSegments.map((s) => [`${s.fontName.family} ${s.fontName.style}`, s.fontName])
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
    node.setRangeLetterSpacing(0, len, { value: 0, unit: "PIXELS" });
    if (node.lineHeight === figma.mixed) {
      for (const seg of node.getStyledTextSegments(["lineHeight"])) {
        if (seg.lineHeight.unit === "AUTO") node.setRangeLineHeight(seg.start, seg.end, { unit: "PERCENT", value: 100 });
      }
    } else if (node.lineHeight.unit === "AUTO") {
      node.setRangeLineHeight(0, len, { unit: "PERCENT", value: 100 });
    }
    if (node.leadingTrim !== "NONE") {
      node.leadingTrim = "NONE";
    }
  }
  function targetStyleFor(originalStyle) {
    const bold = /bold/i.test(originalStyle);
    const italic = /italic/i.test(originalStyle);
    if (bold && italic) return "Bold Italic";
    if (bold) return "Bold";
    if (italic) return "Italic";
    return "Regular";
  }
  async function tryLoadFont(family, style) {
    try {
      await figma.loadFontAsync({ family, style });
      return { family, style };
    } catch {
      if (style === "Regular") return void 0;
      try {
        await figma.loadFontAsync({ family, style: "Regular" });
        return { family, style: "Regular" };
      } catch {
        return void 0;
      }
    }
  }

  // src/serialize/templateValidation.ts
  var RASTER_WARNING_CODES = /* @__PURE__ */ new Set([
    "FONT_MISSING",
    "GRADIENT_RASTERIZED",
    "EFFECT_RASTERIZED",
    "BLEND_MODE_RASTERIZED",
    "MASK_RASTERIZED",
    "VECTOR_RASTERIZED",
    "LINE_RASTERIZED",
    "LETTER_SPACING_LOST",
    "CORNER_RADIUS_RASTERIZED",
    "MULTIPLE_FILLS_RASTERIZED",
    "CONTAINER_BACKGROUND_RASTERIZED",
    // Pas un raster, mais bloquant quand même en mode template : un tag de
    // placeholder mal orthographié (`[[titel]]`…) signifie qu'un placeholder
    // prévu MANQUERA dans le template livré — exactement le genre d'erreur qui
    // retombe sur tous les futurs utilisateurs, donc à corriger avant création
    // plutôt qu'à ignorer en silence.
    "PLACEHOLDER_TAG_UNKNOWN"
  ]);
  function enforceTemplateStrictness(warnings) {
    return warnings.map((w) => RASTER_WARNING_CODES.has(w.code) ? { ...w, severity: "blocking" } : w);
  }
  function hasBlockingWarnings(warnings) {
    return warnings.some((w) => w.severity === "blocking");
  }

  // src/serialize/templateSummary.ts
  function toHex(color) {
    const channel = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0").toUpperCase();
    return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
  }
  function colorKey(hex, alpha) {
    return `${hex}:${alpha.toFixed(2)}`;
  }
  function summarizeColors(elements) {
    const byKey = /* @__PURE__ */ new Map();
    const record = (color) => {
      const hex = toHex(color);
      const key = colorKey(hex, color.a);
      const existing = byKey.get(key);
      if (existing) {
        existing.usageCount++;
      } else {
        byKey.set(key, { hex, alpha: color.a, usageCount: 1 });
      }
    };
    for (const el of elements) {
      switch (el.kind) {
        case "shape":
          if (el.fill) record(el.fill.color);
          if (el.stroke) record(el.stroke.color);
          break;
        case "line":
          record(el.stroke.color);
          break;
        case "text":
          for (const run of el.runs) record(run.color);
          break;
        case "image":
          break;
      }
    }
    return [...byKey.values()];
  }
  function summarizeFonts(elements) {
    const byFamily = /* @__PURE__ */ new Map();
    for (const el of elements) {
      if (el.kind !== "text") continue;
      for (const run of el.runs) {
        const weights = byFamily.get(run.fontFamily) ?? /* @__PURE__ */ new Set();
        weights.add(run.fontWeight);
        byFamily.set(run.fontFamily, weights);
      }
    }
    return [...byFamily.entries()].map(([family, weights]) => ({ family, weights: [...weights].sort((a, b) => a - b) }));
  }
  function summarizePlaceholders(elements) {
    const result = [];
    for (const el of elements) {
      if (!el.placeholder) continue;
      result.push({ id: el.id, sourceNodeId: el.sourceNodeId, role: el.placeholder.role, label: el.placeholder.label });
    }
    return result;
  }
  function aggregateColorSwatches(perLayoutColors) {
    const byKey = /* @__PURE__ */ new Map();
    for (const colors of perLayoutColors) {
      for (const c of colors) {
        const key = colorKey(c.hex, c.alpha);
        const existing = byKey.get(key);
        if (existing) {
          existing.usageCount += c.usageCount;
        } else {
          byKey.set(key, { ...c });
        }
      }
    }
    return [...byKey.values()];
  }

  // src/serialize/templateTheme.ts
  var DEFAULT_THEME_ROLE_COLORS = {
    DARK1: { r: 0, g: 0, b: 0 },
    LIGHT1: { r: 1, g: 1, b: 1 },
    DARK2: { r: 0.26, g: 0.26, b: 0.26 },
    LIGHT2: { r: 0.94, g: 0.94, b: 0.94 },
    ACCENT1: { r: 0.26, g: 0.52, b: 0.96 },
    ACCENT2: { r: 0.86, g: 0.2, b: 0.18 },
    ACCENT3: { r: 0.98, g: 0.74, b: 0.02 },
    ACCENT4: { r: 0.06, g: 0.62, b: 0.35 },
    ACCENT5: { r: 1, g: 0.6, b: 0 },
    ACCENT6: { r: 0.4, g: 0.4, b: 0.4 },
    HYPERLINK: { r: 0.06, g: 0.4, b: 0.84 },
    FOLLOWED_HYPERLINK: { r: 0.4, g: 0.24, b: 0.6 }
  };
  var THEME_ROLES = [
    "DARK1",
    "LIGHT1",
    "DARK2",
    "LIGHT2",
    "ACCENT1",
    "ACCENT2",
    "ACCENT3",
    "ACCENT4",
    "ACCENT5",
    "ACCENT6",
    "HYPERLINK",
    "FOLLOWED_HYPERLINK"
  ];
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255 };
  }
  function rgbToHex({ r, g, b }) {
    const channel = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0").toUpperCase();
    return `#${channel(r)}${channel(g)}${channel(b)}`;
  }
  var DEFAULT_THEME_ROLE_HEX = THEME_ROLES.reduce(
    (acc, role) => ({ ...acc, [role]: rgbToHex(DEFAULT_THEME_ROLE_COLORS[role]) }),
    {}
  );
  function buildTemplateTheme(colorRoles, colors, roleColorOverrides = {}) {
    if (Object.keys(colorRoles).length === 0 && Object.keys(roleColorOverrides).length === 0) return void 0;
    const byKey = new Map(colors.map((c) => [colorKey(c.hex, c.alpha), c]));
    const theme = { ...DEFAULT_THEME_ROLE_COLORS };
    for (const [key, role] of Object.entries(colorRoles)) {
      const swatch = byKey.get(key);
      if (swatch) theme[role] = hexToRgb(swatch.hex);
    }
    for (const [role, hex] of Object.entries(roleColorOverrides)) {
      theme[role] = hexToRgb(hex);
    }
    return theme;
  }
  function recolor(color, colorRoles) {
    const role = colorRoles[colorKey(toHex(color), color.a)];
    return role ? { ...color, themeRole: role } : color;
  }
  function applyThemeRolesToElements(elements, colorRoles) {
    if (Object.keys(colorRoles).length === 0) return elements;
    return elements.map((el) => {
      switch (el.kind) {
        case "shape": {
          const shape = el;
          return {
            ...shape,
            fill: shape.fill ? { ...shape.fill, color: recolor(shape.fill.color, colorRoles) } : shape.fill,
            stroke: shape.stroke ? { ...shape.stroke, color: recolor(shape.stroke.color, colorRoles) } : shape.stroke
          };
        }
        case "line": {
          const line = el;
          return { ...line, stroke: { ...line.stroke, color: recolor(line.stroke.color, colorRoles) } };
        }
        case "text": {
          const text = el;
          return { ...text, runs: text.runs.map((run) => ({ ...run, color: recolor(run.color, colorRoles) })) };
        }
        case "image":
          return el;
      }
    });
  }

  // src/serialize/templatePlaceholderText.ts
  function applyPlaceholderText(elements) {
    return elements.map((el) => {
      if (el.kind !== "text" || !el.placeholder) return el;
      const text = el;
      const placeholder = text.placeholder;
      const content = `[${placeholder.label}]`;
      const baseRun = text.runs[0];
      const runs = baseRun ? [{ ...baseRun, start: 0, end: content.length }] : [];
      const baseParagraph = text.paragraphs[0];
      const paragraphs = baseParagraph ? [{ ...baseParagraph, start: 0, end: content.length }] : [];
      return { ...text, content, runs, paragraphs };
    });
  }

  // src/code.ts
  var MAX_FRAMES_WARNING = 20;
  var TEMPLATE_MAX_LAYOUTS = 10;
  var PREVIEW_WIDTH = 960;
  var SLIDES_READY_KEY = "slidesExportReady";
  var DECK_TAG = "true";
  var TEMPLATE_TAG = "template";
  var LINT_GROUP_ID_KEY = "slidesLintGroupId";
  var LINT_STROKE_MAX = 8;
  var LINT_STROKE_MIN = 1.5;
  var LINT_STROKE_RATIO = 0.15;
  var LINT_COLOR_RASTERIZED = { r: 0.94, g: 0.23, b: 0.18 };
  var LINT_COLOR_VISUAL_DIFF = { r: 0.96, g: 0.62, b: 0.04 };
  function lintStrokeWeightFor(width, height) {
    const minDim = Math.min(width, height);
    return Math.min(LINT_STROKE_MAX, Math.max(LINT_STROKE_MIN, minDim * LINT_STROKE_RATIO));
  }
  var SLIDES_READY_PREFIX = "[Slides Ready] ";
  var TEMPLATE_READY_PREFIX = "[Template Ready] ";
  var COPY_GAP_PX = 200;
  var SESSION_TOKEN_STORAGE_KEY = "f2s:sessionToken";
  var UI_SKIN_STORAGE_KEY = "f2s:uiSkin";
  var THEME_STORAGE_KEY = "f2s:theme";
  function isExportable(node) {
    return node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE";
  }
  function readyTagOf(node) {
    return node.getPluginData(SLIDES_READY_KEY);
  }
  function isSlidesReady(node) {
    return readyTagOf(node) === DECK_TAG;
  }
  function isTemplateReady(node) {
    return readyTagOf(node) === TEMPLATE_TAG;
  }
  function stripReadyPrefix(name) {
    if (name.startsWith(SLIDES_READY_PREFIX)) return name.slice(SLIDES_READY_PREFIX.length);
    if (name.startsWith(TEMPLATE_READY_PREFIX)) return name.slice(TEMPLATE_READY_PREFIX.length);
    return name;
  }
  function yieldToUi() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
  function collectFontSubstitutions(slide) {
    const seen = /* @__PURE__ */ new Set();
    const subs = [];
    for (const el of slide.elements) {
      if (el.kind !== "text") continue;
      for (const run of el.runs) {
        if (!run.originalFontFamily) continue;
        const key = `${run.originalFontFamily}\u2192${run.fontFamily}`;
        if (seen.has(key)) continue;
        seen.add(key);
        subs.push({ original: run.originalFontFamily, resolved: run.fontFamily });
      }
    }
    return subs;
  }
  function applyFontOverrides(slide, overrides) {
    if (Object.keys(overrides).length === 0) return;
    for (const el of slide.elements) {
      if (el.kind !== "text") continue;
      for (const run of el.runs) {
        const override = run.originalFontFamily && overrides[run.originalFontFamily];
        if (override) run.fontFamily = override;
      }
    }
  }
  async function generatePreview(node) {
    const bytes = await node.exportAsync({ format: "PNG", constraint: { type: "WIDTH", value: PREVIEW_WIDTH } });
    return `data:image/png;base64,${figma.base64Encode(bytes)}`;
  }
  function postCandidateMessage(type, frame, previewDataUrl, slide) {
    const nativeCount = slide.elements.filter((e) => e.kind !== "image" || !e.isRasterFallback).length;
    const rasterCount = slide.elements.length - nativeCount;
    figma.ui.postMessage({
      type,
      frame: { id: frame.id, name: frame.name, width: frame.width, height: frame.height },
      previewDataUrl,
      nativeCount,
      rasterCount,
      warnings: slide.warnings,
      fontSubstitutions: collectFontSubstitutions(slide)
    });
  }
  var RATIO_TOLERANCE = 0.01;
  function sameAspectRatio(a, b) {
    if (a.height <= 0 || b.height <= 0) return false;
    const ra = a.width / a.height;
    const rb = b.width / b.height;
    return Math.abs(ra - rb) / rb <= RATIO_TOLERANCE;
  }
  function filterMatchingRatio(nodes, reference) {
    const ref = reference ?? nodes[0];
    if (!ref) return nodes;
    const kept = nodes.filter((n) => sameAspectRatio(n, ref));
    const rejected = nodes.length - kept.length;
    if (rejected > 0) {
      figma.notify(
        `${rejected} frame(s) skipped: a Slides presentation has a single page size, so every frame must match the aspect ratio of "${stripReadyPrefix(ref.name)}".`,
        { error: true, timeout: 6e3 }
      );
    }
    return kept;
  }
  async function addFrames(nodes, pending, idGen) {
    const known = new Set(pending.map((p) => p.frame.id));
    const candidates = nodes.filter((n) => !known.has(n.id));
    const toAdd = filterMatchingRatio(candidates, pending[0]?.frame);
    if (toAdd.length === 0) return;
    if (toAdd.length > MAX_FRAMES_WARNING) {
      figma.ui.postMessage({ type: "too-many-frames", count: toAdd.length, max: MAX_FRAMES_WARNING });
    }
    for (const frame of toAdd) {
      const previewDataUrl = await generatePreview(frame);
      const { slide, nodesToRaster } = await serializeFrame(frame, { nextId: idGen });
      pending.push({ frame, slide, nodesToRaster });
      postCandidateMessage("candidate-added", frame, previewDataUrl, slide);
      await yieldToUi();
    }
  }
  async function refreshPendingEntry(frame, pending, idGen) {
    const idx = pending.findIndex((p) => p.frame.id === frame.id);
    if (idx === -1) return false;
    const previewDataUrl = await generatePreview(frame);
    const { slide, nodesToRaster } = await serializeFrame(frame, { nextId: idGen });
    pending[idx] = { frame, slide, nodesToRaster };
    const warnings = await lintFrame(frame);
    await addLintAnnotations(frame, warnings);
    postCandidateMessage("candidate-updated", frame, previewDataUrl, slide);
    return true;
  }
  async function addSelectedFrames(pending, idGen) {
    const selected = figma.currentPage.selection.filter(isExportable);
    if (selected.length === 0) {
      figma.ui.postMessage({ type: "no-frames-selected" });
      return;
    }
    await addFrames(selected, pending, idGen);
  }
  async function loadTaggedFrames(pending, templatePending, idGen) {
    const deckTagged = figma.currentPage.findAll((n) => isExportable(n) && isSlidesReady(n));
    if (deckTagged.length > 0) await addFrames(deckTagged, pending, idGen);
    const templateTagged = figma.currentPage.findAll((n) => isExportable(n) && isTemplateReady(n));
    if (templateTagged.length > 0) await addTemplateLayoutNodes(templateTagged, templatePending, idGen);
  }
  function flattenAutoLayout(node) {
    if ("layoutMode" in node && node.layoutMode !== "NONE") {
      node.layoutMode = "NONE";
    }
    if ("children" in node) {
      for (const child of node.children) flattenAutoLayout(child);
    }
  }
  async function removeLintAnnotations(copy) {
    const groupId = copy.getPluginData(LINT_GROUP_ID_KEY);
    if (!groupId) return;
    const group = await figma.getNodeByIdAsync(groupId);
    if (group && !group.removed) group.remove();
    copy.setPluginData(LINT_GROUP_ID_KEY, "");
  }
  async function addLintAnnotations(copy, warnings) {
    await removeLintAnnotations(copy);
    if (warnings.length === 0) return;
    const badges = [];
    for (const w of warnings) {
      const node = await figma.getNodeByIdAsync(w.nodeId);
      if (!node || !("absoluteBoundingBox" in node) || !node.absoluteBoundingBox) continue;
      const box = node.absoluteBoundingBox;
      const badge = figma.createRectangle();
      badge.resize(Math.max(box.width, 1), Math.max(box.height, 1));
      badge.x = box.x;
      badge.y = box.y;
      badge.fills = [];
      badge.strokes = [{ type: "SOLID", color: w.category === "visual-diff" ? LINT_COLOR_VISUAL_DIFF : LINT_COLOR_RASTERIZED }];
      badge.strokeWeight = lintStrokeWeightFor(box.width, box.height);
      badge.strokeAlign = "OUTSIDE";
      if ("cornerRadius" in node && typeof node.cornerRadius === "number") {
        badge.cornerRadius = node.cornerRadius;
      }
      badge.name = `${w.category === "visual-diff" ? "\u25D0" : "\u26A0"} ${w.nodeName} \u2014 ${w.message}`;
      badges.push(badge);
    }
    if (badges.length === 0) return;
    const group = badges.length > 1 ? figma.group(badges, figma.currentPage) : badges[0];
    group.name = `Slides lint \u2014 ${stripReadyPrefix(copy.name)}`;
    group.locked = true;
    if ("expanded" in group) group.expanded = false;
    copy.setPluginData(LINT_GROUP_ID_KEY, group.id);
  }
  async function prepareFrameForSlides(source, fontOverrides, tag = DECK_TAG) {
    let copy;
    if (readyTagOf(source) === tag) {
      copy = source;
    } else {
      const clone = source.clone();
      if (!isExportable(clone)) throw new Error(`Unexpected clone type for "${source.name}"`);
      copy = clone;
      copy.x = source.x + source.width + COPY_GAP_PX;
      copy.y = source.y;
      copy.name = (tag === TEMPLATE_TAG ? TEMPLATE_READY_PREFIX : SLIDES_READY_PREFIX) + stripReadyPrefix(source.name);
      copy.setPluginData(SLIDES_READY_KEY, tag);
    }
    flattenAutoLayout(copy);
    await reformatForSlides(copy, fontOverrides);
    const warnings = await lintFrame(copy);
    await addLintAnnotations(copy, warnings);
    return { copy, warnings };
  }
  async function handlePrepareForSlides(pending, idGen, fontOverrides, deckFrameIds) {
    const deckNodes = (await Promise.all(deckFrameIds.map((id) => figma.getNodeByIdAsync(id)))).filter((n) => n !== null && isExportable(n));
    const canvasSelected = figma.currentPage.selection.filter(isExportable);
    const targets = /* @__PURE__ */ new Map();
    for (const n of [...deckNodes, ...canvasSelected]) targets.set(n.id, n);
    if (targets.size === 0) {
      figma.notify("Select at least one frame on the canvas, or add frames to the deck first.", { error: true });
      return;
    }
    const copies = [];
    const newlyCreated = [];
    let totalWarnings = 0;
    for (const frame of targets.values()) {
      const wasAlreadyTagged = isSlidesReady(frame);
      const { copy, warnings } = await prepareFrameForSlides(frame, fontOverrides);
      copies.push(copy);
      totalWarnings += warnings.length;
      if (wasAlreadyTagged) {
        await refreshPendingEntry(copy, pending, idGen);
      } else {
        newlyCreated.push(copy);
        const rawIdx = pending.findIndex((p) => p.frame.id === frame.id);
        if (rawIdx !== -1) {
          pending.splice(rawIdx, 1);
          figma.ui.postMessage({ type: "candidate-removed", id: frame.id });
        }
      }
      await yieldToUi();
    }
    figma.currentPage.selection = copies;
    figma.viewport.scrollAndZoomIntoView(copies);
    const label = copies.length === 1 ? "frame" : "frames";
    figma.notify(
      totalWarnings === 0 ? `Prepared ${copies.length} ${label} for Slides \u2014 no issues found.` : `Prepared ${copies.length} ${label} for Slides \u2014 ${totalWarnings} issue(s) flagged on canvas (red = rasterized, orange = may look different).`
    );
    await addFrames(newlyCreated, pending, idGen);
  }
  function postTemplateCandidateMessage(type, frame, previewDataUrl, slide) {
    figma.ui.postMessage({
      type,
      frame: { id: frame.id, name: frame.name, width: frame.width, height: frame.height },
      previewDataUrl,
      warnings: slide.warnings,
      blocking: hasBlockingWarnings(slide.warnings),
      placeholders: summarizePlaceholders(slide.elements),
      colors: summarizeColors(slide.elements),
      fonts: summarizeFonts(slide.elements),
      fontSubstitutions: collectFontSubstitutions(slide)
    });
  }
  async function addTemplateLayoutNodes(nodes, pending, idGen) {
    const known = new Set(pending.map((p) => p.frame.id));
    const candidates = filterMatchingRatio(nodes.filter((n) => !known.has(n.id)), pending[0]?.frame);
    if (candidates.length === 0) return;
    const remaining = TEMPLATE_MAX_LAYOUTS - pending.length;
    const toAdd = candidates.slice(0, Math.max(0, remaining));
    if (toAdd.length < candidates.length) {
      figma.ui.postMessage({ type: "too-many-frames", count: pending.length + candidates.length, max: TEMPLATE_MAX_LAYOUTS });
      figma.notify(
        `A template is capped at ${TEMPLATE_MAX_LAYOUTS} layouts (plugin limit to keep templates focused) \u2014 ${candidates.length - toAdd.length} frame(s) not added.`,
        { error: true, timeout: 6e3 }
      );
    }
    for (const frame of toAdd) {
      const previewDataUrl = await generatePreview(frame);
      const { slide, nodesToRaster } = await serializeFrame(frame, { nextId: idGen });
      slide.warnings = enforceTemplateStrictness(slide.warnings);
      pending.push({ frame, slide, nodesToRaster });
      postTemplateCandidateMessage("template-candidate-added", frame, previewDataUrl, slide);
      await yieldToUi();
    }
  }
  async function addSelectedTemplateLayouts(pending, idGen) {
    const selected = figma.currentPage.selection.filter(isExportable);
    if (selected.length === 0) {
      figma.ui.postMessage({ type: "no-frames-selected" });
      return;
    }
    await addTemplateLayoutNodes(selected, pending, idGen);
  }
  async function refreshTemplateEntry(frame, pending, idGen) {
    const idx = pending.findIndex((p) => p.frame.id === frame.id);
    if (idx === -1) return false;
    const previewDataUrl = await generatePreview(frame);
    const { slide, nodesToRaster } = await serializeFrame(frame, { nextId: idGen });
    slide.warnings = enforceTemplateStrictness(slide.warnings);
    pending[idx] = { frame, slide, nodesToRaster };
    if (isTemplateReady(frame)) {
      const warnings = await lintFrame(frame);
      await addLintAnnotations(frame, warnings);
    }
    postTemplateCandidateMessage("template-candidate-updated", frame, previewDataUrl, slide);
    return true;
  }
  async function handlePrepareTemplateForSlides(pending, idGen, fontOverrides, layoutFrameIds) {
    const listNodes = (await Promise.all(layoutFrameIds.map((id) => figma.getNodeByIdAsync(id)))).filter((n) => n !== null && isExportable(n));
    const canvasSelected = figma.currentPage.selection.filter(isExportable);
    const targets = /* @__PURE__ */ new Map();
    for (const n of [...listNodes, ...canvasSelected]) targets.set(n.id, n);
    if (targets.size === 0) {
      figma.notify("Select at least one frame on the canvas, or add layouts to the template first.", { error: true });
      return;
    }
    const copies = [];
    const newlyCreated = [];
    let totalWarnings = 0;
    for (const frame of targets.values()) {
      const wasAlreadyTagged = isTemplateReady(frame);
      const { copy, warnings } = await prepareFrameForSlides(frame, fontOverrides, TEMPLATE_TAG);
      copies.push(copy);
      totalWarnings += warnings.length;
      if (wasAlreadyTagged) {
        await refreshTemplateEntry(copy, pending, idGen);
      } else {
        newlyCreated.push(copy);
        const rawIdx = pending.findIndex((p) => p.frame.id === frame.id);
        if (rawIdx !== -1) {
          pending.splice(rawIdx, 1);
          figma.ui.postMessage({ type: "template-candidate-removed", id: frame.id });
        }
      }
      await yieldToUi();
    }
    figma.currentPage.selection = copies;
    figma.viewport.scrollAndZoomIntoView(copies);
    const label = copies.length === 1 ? "layout" : "layouts";
    figma.notify(
      totalWarnings === 0 ? `Prepared ${copies.length} ${label} for Slides \u2014 no issues found.` : `Prepared ${copies.length} ${label} for Slides \u2014 ${totalWarnings} issue(s) flagged on canvas (red = rasterized, orange = may look different).`
    );
    await addTemplateLayoutNodes(newlyCreated, pending, idGen);
  }
  var LIVE_REFRESH_IGNORABLE_PROPERTIES = /* @__PURE__ */ new Set(["pluginData"]);
  function isOnlyIgnorableNodeChange(change) {
    return change.type === "PROPERTY_CHANGE" && change.properties.every((p) => LIVE_REFRESH_IGNORABLE_PROPERTIES.has(p));
  }
  function nearestTrackedAncestor(node, trackedIds, accepts) {
    let current = node;
    while (current) {
      if (isExportable(current) && trackedIds.has(current.id) && accepts(current)) {
        return current;
      }
      current = "parent" in current ? current.parent : null;
    }
    return void 0;
  }
  var LIVE_REFRESH_DEBOUNCE_MS = 700;
  function watchFramesForLiveRefresh(pending, accepts, refresh) {
    const dirtyIds = /* @__PURE__ */ new Set();
    let timer;
    const flush = async () => {
      timer = void 0;
      const ids = [...dirtyIds];
      dirtyIds.clear();
      for (const id of ids) {
        try {
          const node = await figma.getNodeByIdAsync(id);
          if (!node || !isExportable(node)) continue;
          await refresh(node);
        } catch (err) {
          console.error(`[figma-to-slides] live refresh failed for ${id}`, err);
        }
        await yieldToUi();
      }
    };
    const scheduleFlush = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), LIVE_REFRESH_DEBOUNCE_MS);
    };
    figma.currentPage.on("nodechange", (event) => {
      if (pending.length === 0) return;
      const trackedIds = new Set(pending.map((p) => p.frame.id));
      let dirty = false;
      for (const change of event.nodeChanges) {
        if (change.type === "DELETE") continue;
        if (isOnlyIgnorableNodeChange(change)) continue;
        const node = change.node;
        if (!node || node.removed) continue;
        const match = nearestTrackedAncestor(node, trackedIds, accepts);
        if (match) {
          dirtyIds.add(match.id);
          dirty = true;
        }
      }
      if (!dirty) return;
      scheduleFlush();
    });
    return {
      refreshFromSelection(selection) {
        if (pending.length === 0 || selection.length === 0) return;
        const trackedIds = new Set(pending.map((p) => p.frame.id));
        let dirty = false;
        for (const node of selection) {
          const match = nearestTrackedAncestor(node, trackedIds, accepts);
          if (match) {
            dirtyIds.add(match.id);
            dirty = true;
          }
        }
        if (!dirty) return;
        scheduleFlush();
      }
    };
  }
  async function main() {
    let storedSkin;
    let storedTheme;
    try {
      [storedSkin, storedTheme] = await Promise.all([
        figma.clientStorage.getAsync(UI_SKIN_STORAGE_KEY),
        figma.clientStorage.getAsync(THEME_STORAGE_KEY)
      ]);
    } catch (err) {
      console.error(err);
    }
    const initialSkin = storedSkin === "win95" || storedSkin === "modern" || storedSkin === "hybrid" ? storedSkin : "win95";
    const initialThemeClass = storedTheme === "light" ? "f2s-theme-light" : storedTheme === "dark" ? "f2s-theme-dark" : "";
    const html = __html__.replace("__F2S_INITIAL_SKIN__", `f2s-skin--${initialSkin}`).replace("__F2S_INITIAL_THEME__", initialThemeClass);
    figma.showUI(html, { width: 960, height: 640, themeColors: true });
    const pending = [];
    const templatePending = [];
    const idGen = createIdGenerator(figma.root.id.slice(0, 8));
    const deckLiveRefresh = watchFramesForLiveRefresh(pending, isSlidesReady, (frame) => refreshPendingEntry(frame, pending, idGen));
    const templateLiveRefresh = watchFramesForLiveRefresh(templatePending, () => true, (frame) => refreshTemplateEntry(frame, templatePending, idGen));
    figma.on("selectionchange", () => {
      const selection = figma.currentPage.selection;
      figma.ui.postMessage({
        type: "canvas-selection-changed",
        hasSelection: selection.some(isExportable)
      });
      deckLiveRefresh.refreshFromSelection(selection);
      templateLiveRefresh.refreshFromSelection(selection);
    });
    figma.ui.onmessage = async (msg) => {
      if (msg.type === "ui-ready") {
        figma.ui.postMessage({
          type: "canvas-selection-changed",
          hasSelection: figma.currentPage.selection.some(isExportable)
        });
        figma.ui.postMessage({ type: "skin-restored", skin: initialSkin });
        try {
          const storedToken = await figma.clientStorage.getAsync(SESSION_TOKEN_STORAGE_KEY);
          figma.ui.postMessage({
            type: "session-token-restored",
            token: typeof storedToken === "string" ? storedToken : ""
          });
        } catch (err) {
          console.error(err);
          figma.ui.postMessage({ type: "session-token-restored", token: "" });
        }
        if (storedTheme === "light" || storedTheme === "dark") {
          figma.ui.postMessage({ type: "theme-preference-restored", theme: storedTheme });
        }
        try {
          await loadTaggedFrames(pending, templatePending, idGen);
        } catch (err) {
          console.error(err);
        }
        return;
      }
      if (msg.type === "save-theme-preference") {
        try {
          await figma.clientStorage.setAsync(THEME_STORAGE_KEY, msg.theme);
        } catch (err) {
          console.error(err);
        }
        return;
      }
      if (msg.type === "save-session-token") {
        try {
          await figma.clientStorage.setAsync(SESSION_TOKEN_STORAGE_KEY, msg.token);
        } catch (err) {
          console.error(err);
        }
        return;
      }
      if (msg.type === "save-ui-skin") {
        try {
          await figma.clientStorage.setAsync(UI_SKIN_STORAGE_KEY, msg.skin);
        } catch (err) {
          console.error(err);
        }
        return;
      }
      if (msg.type === "close-plugin") {
        figma.closePlugin();
        return;
      }
      if (msg.type === "clear-session-token") {
        try {
          await figma.clientStorage.deleteAsync(SESSION_TOKEN_STORAGE_KEY);
        } catch (err) {
          console.error(err);
        }
        return;
      }
      if (msg.type === "add-selected-frames") {
        try {
          await addSelectedFrames(pending, idGen);
        } catch (err) {
          console.error(err);
          figma.ui.postMessage({ type: "export-error", message: err.message });
        }
        return;
      }
      if (msg.type === "prepare-for-slides") {
        try {
          await handlePrepareForSlides(pending, idGen, msg.fontOverrides ?? {}, msg.deckFrameIds ?? []);
        } catch (err) {
          console.error(err);
          figma.notify(`Prepare for Slides failed: ${err.message}`, { error: true });
        }
        return;
      }
      if (msg.type === "add-template-layout") {
        try {
          await addSelectedTemplateLayouts(templatePending, idGen);
        } catch (err) {
          console.error(err);
          figma.ui.postMessage({ type: "export-error", message: err.message });
        }
        return;
      }
      if (msg.type === "prepare-template-for-slides") {
        try {
          await handlePrepareTemplateForSlides(
            templatePending,
            idGen,
            msg.fontOverrides ?? {},
            msg.layoutFrameIds ?? []
          );
        } catch (err) {
          console.error(err);
          figma.notify(`Prepare for Slides failed: ${err.message}`, { error: true });
        }
        return;
      }
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
        return;
      }
      if (msg.type === "request-export-debug") {
        try {
          const m = msg;
          const orderedIds = m.order.filter((id) => m.includedFrameIds.includes(id));
          const { slides, assets } = await collectSlidesAndAssets(pending, orderedIds, m.fontOverrides ?? {}, 2);
          const doc = {
            version: 1,
            presentationTitle: m.presentationTitle,
            slideSize: computeSlideSizePt(slides[0]?.frameSize),
            slides,
            options: { mode: "new-presentation", rasterScale: 2, includeUnderlay: false, underlayOpacity: 0.3, strictMode: false }
          };
          figma.ui.postMessage({ type: "export-debug-payload", document: doc });
          for (const asset of assets) {
            figma.ui.postMessage({ type: "export-debug-asset", assetKey: asset.assetKey, bytes: asset.bytes.buffer });
          }
        } catch (err) {
          console.error(err);
          figma.ui.postMessage({ type: "export-error", message: err.message });
        }
        return;
      }
      if (msg.type === "request-template") {
        try {
          await handleTemplateCreateRequest(
            msg,
            templatePending
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
  async function collectSlidesAndAssets(pending, orderedIds, fontOverrides, rasterScale) {
    const byId = new Map(pending.map((p) => [p.frame.id, p]));
    const slides = [];
    const assets = [];
    for (let i = 0; i < orderedIds.length; i++) {
      const p = byId.get(orderedIds[i]);
      if (!p) continue;
      applyFontOverrides(p.slide, fontOverrides);
      for (const [assetKey, nodes] of p.nodesToRaster) {
        const node = nodes[0];
        const scaleConstraint = { type: "SCALE", value: rasterScale };
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
    return { slides, assets };
  }
  function postExportPayload(doc, assets) {
    figma.ui.postMessage({
      type: "export-payload",
      document: doc,
      assets: assets.map((a) => ({ assetKey: a.assetKey, mimeType: a.mimeType }))
    });
    for (const asset of assets) {
      figma.ui.postMessage({ type: "export-asset", assetKey: asset.assetKey, bytes: asset.bytes.buffer });
    }
  }
  async function handleExportRequest(msg, pending) {
    const orderedIds = msg.order.filter((id) => msg.includedFrameIds.includes(id));
    const { slides, assets } = await collectSlidesAndAssets(pending, orderedIds, msg.fontOverrides ?? {}, msg.options.rasterScale);
    const doc = {
      version: 1,
      presentationTitle: msg.presentationTitle,
      slideSize: computeSlideSizePt(slides[0]?.frameSize),
      slides,
      options: msg.options
    };
    postExportPayload(doc, assets);
  }
  async function handleTemplateCreateRequest(msg, pending) {
    const byId = new Map(pending.map((p) => [p.frame.id, p]));
    const orderedIds = msg.order.filter((id) => msg.includedFrameIds.includes(id));
    const blocked = orderedIds.map((id) => byId.get(id)).find((p) => Boolean(p) && hasBlockingWarnings(p.slide.warnings));
    if (blocked) {
      figma.ui.postMessage({
        type: "export-error",
        message: `"${blocked.frame.name}" still contains elements that would be converted to images \u2014 fix them in Figma before creating the template.`
      });
      return;
    }
    const { slides, assets } = await collectSlidesAndAssets(pending, orderedIds, msg.fontOverrides ?? {}, 2);
    const colorRoles = msg.colorRoles ?? {};
    const allColors = aggregateColorSwatches(slides.map((s) => summarizeColors(s.elements)));
    const theme = buildTemplateTheme(colorRoles, allColors, msg.roleColorOverrides ?? {});
    for (const slide of slides) {
      slide.elements = applyThemeRolesToElements(slide.elements, colorRoles);
      slide.elements = applyPlaceholderText(slide.elements);
    }
    const doc = {
      version: 1,
      presentationTitle: msg.presentationTitle,
      slideSize: computeSlideSizePt(slides[0]?.frameSize),
      slides,
      options: { mode: "new-presentation", rasterScale: 2, includeUnderlay: false, underlayOpacity: 0.3, strictMode: true },
      theme
    };
    postExportPayload(doc, assets);
  }
  main().catch((err) => {
    console.error(err);
    figma.notify(`Plugin error: ${err.message}`, { error: true });
  });
})();
