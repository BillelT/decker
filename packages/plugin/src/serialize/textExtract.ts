import type { IRParagraph, IRTextRun } from '@figma-to-slides/shared';
import { resolveFontFamily, parseFontWeight } from './fonts.js';
import { applyTextCase, mapAlignment, mapLineSpacing, letterSpacingImpactRatio, LETTER_SPACING_RASTER_THRESHOLD } from './textMapping.js';

export interface TextExtractionResult {
  content: string;
  runs: IRTextRun[];
  paragraphs: IRParagraph[];
  requiresRaster: boolean;
  rasterReason?: string;
  fontWarnings: { original: string; substitute?: string }[];
}

const SEGMENT_FIELDS = [
  'fontSize',
  'fontName',
  'fontWeight',
  'fills',
  'textDecoration',
  'textCase',
  'letterSpacing',
  'lineHeight',
  'hyperlink',
  'listOptions',
  'indentation',
] as const;

/**
 * Spec §3.5 CONTRAT — utilise `getStyledTextSegments`, jamais les
 * propriétés de premier niveau (`figma.mixed`, piège §11.10).
 */
export function extractTextRuns(node: TextNode): TextExtractionResult {
  const segments = node.getStyledTextSegments([...SEGMENT_FIELDS]) as unknown as StyledTextSegment[];
  const runs: IRTextRun[] = [];
  const fontWarnings: TextExtractionResult['fontWarnings'] = [];
  let requiresRaster = false;
  let rasterReason: string | undefined;

  for (const seg of segments) {
    const resolution = resolveFontFamily(seg.fontName.family);
    if (resolution.status === 'missing') {
      requiresRaster = true;
      rasterReason = `Police « ${resolution.original} » indisponible et non substituable.`;
      fontWarnings.push({ original: resolution.original });
    } else if (resolution.status === 'substituted') {
      fontWarnings.push({ original: resolution.original, substitute: resolution.family });
    }

    const family = resolution.status === 'missing' ? seg.fontName.family : resolution.family;
    const width = estimateSegmentWidthPx(seg);
    if (seg.letterSpacing.unit === 'PIXELS' && seg.letterSpacing.value !== 0) {
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
      underline: seg.textDecoration === 'UNDERLINE' ? true : undefined,
      strikethrough: seg.textDecoration === 'STRIKETHROUGH' ? true : undefined,
      smallCaps: seg.textCase === 'SMALL_CAPS' ? true : undefined,
      link: seg.hyperlink && seg.hyperlink.type === 'URL' ? seg.hyperlink.value : undefined,
      originalFontFamily: resolution.status === 'substituted' ? resolution.original : undefined,
    });
  }

  const content = segments.map((seg) => applyTextCase(node.characters.slice(seg.start, seg.end), seg.textCase as never)).join('');

  const paragraphs = buildParagraphs(node, segments);

  return { content, runs, paragraphs, requiresRaster, rasterReason, fontWarnings };
}

function buildParagraphs(node: TextNode, segments: StyledTextSegment[]): IRParagraph[] {
  const paragraphs: IRParagraph[] = [];
  const text = node.characters;
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === '\n') {
      const end = i;
      const coveringSegment = segments.find((s) => s.start <= start && start < s.end) ?? segments[segments.length - 1];
      const align = typeof node.textAlignHorizontal === 'string' ? node.textAlignHorizontal : 'LEFT';
      paragraphs.push({
        start,
        end,
        align: mapAlignment(align as never),
        lineSpacingPct: coveringSegment ? mapLineSpacing(coveringSegment.lineHeight as never, coveringSegment.fontSize) : undefined,
        indentStartPt: coveringSegment?.indentation || undefined,
        bullet: coveringSegment?.listOptions?.type === 'ORDERED' ? 'ORDERED' : coveringSegment?.listOptions?.type === 'UNORDERED' ? 'UNORDERED' : undefined,
      });
      start = i + 1;
    }
  }
  return paragraphs;
}

function firstSolidFillColor(fills: readonly Paint[] | typeof figma.mixed): { r: number; g: number; b: number; a: number } | undefined {
  if (fills === figma.mixed || !Array.isArray(fills)) return undefined;
  const solid = fills.find((f): f is SolidPaint => f.type === 'SOLID' && f.visible !== false);
  if (!solid) return undefined;
  return { r: solid.color.r, g: solid.color.g, b: solid.color.b, a: solid.opacity ?? 1 };
}

/**
 * Approximation grossière de la largeur d'un segment en px (moyenne
 * empirique caractère/fontSize) — suffisante pour le seuil §3.5, une
 * mesure exacte nécessiterait `figma.loadFontAsync` + mesure de layout
 * indisponible de façon synchrone ici.
 */
function estimateSegmentWidthPx(seg: StyledTextSegment): number {
  const avgCharWidthRatio = 0.55;
  return seg.fontSize * avgCharWidthRatio * (seg.end - seg.start);
}
