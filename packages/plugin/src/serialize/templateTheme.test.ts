import { describe, expect, it } from 'vitest';
import type { IRElement, IRLine, IRShape, IRText } from '@figma-to-slides/shared';
import {
  applyThemeRolesToElements,
  buildTemplateTheme,
  DEFAULT_THEME_ROLE_COLORS,
  DEFAULT_THEME_ROLE_HEX,
  resolveThemeRoleHexes,
  THEME_ROLES,
} from './templateTheme.js';

function baseShape(overrides: Partial<IRShape> = {}): IRShape {
  return {
    kind: 'shape',
    id: 'el1',
    sourceNodeId: 'n1',
    rect: { x: 0, y: 0, w: 10, h: 10 },
    rotation: 0,
    opacity: 1,
    shapeType: 'RECTANGLE',
    ...overrides,
  };
}

function baseText(overrides: Partial<IRText> = {}): IRText {
  return {
    kind: 'text',
    id: 'el2',
    sourceNodeId: 'n2',
    rect: { x: 0, y: 0, w: 10, h: 10 },
    rotation: 0,
    opacity: 1,
    content: 'Hello',
    runs: [],
    paragraphs: [],
    vAlign: 'TOP',
    tightFit: false,
    ...overrides,
  };
}

function baseLine(overrides: Partial<IRLine> = {}): IRLine {
  return {
    kind: 'line',
    id: 'el3',
    sourceNodeId: 'n3',
    rect: { x: 0, y: 0, w: 100, h: 0 },
    rotation: 0,
    opacity: 1,
    stroke: { color: { r: 0, g: 0, b: 0, a: 1 }, weightPt: 1, dash: 'SOLID' },
    ...overrides,
  };
}

describe('buildTemplateTheme', () => {
  it('returns undefined when no color role has been assigned (creator never touched the Style tab)', () => {
    expect(buildTemplateTheme({}, [{ hex: '#FF6B00', alpha: 1, usageCount: 3 }])).toBeUndefined();
  });

  it('overrides only the assigned roles, falling back to defaults for the rest', () => {
    const theme = buildTemplateTheme({ '#FF6B00:1.00': 'ACCENT1' }, [{ hex: '#FF6B00', alpha: 1, usageCount: 3 }]);
    expect(theme?.ACCENT1).toEqual({ r: 1, g: 0.4196078431372549, b: 0 });
    expect(theme?.DARK1).toEqual(DEFAULT_THEME_ROLE_COLORS.DARK1);
  });

  it('ignores an assignment whose color key matches nothing in the detected colors', () => {
    const theme = buildTemplateTheme({ '#000000:1.00': 'ACCENT2' }, []);
    expect(theme?.ACCENT2).toEqual(DEFAULT_THEME_ROLE_COLORS.ACCENT2);
  });

  it('is not undefined when only a manual hex override is set, with no detected color assigned', () => {
    const theme = buildTemplateTheme({}, [], { ACCENT3: '#00FF00' });
    expect(theme?.ACCENT3).toEqual({ r: 0, g: 1, b: 0 });
    expect(theme?.DARK1).toEqual(DEFAULT_THEME_ROLE_COLORS.DARK1);
  });

  it('lets a manual hex override win over a detected color assigned to the same role', () => {
    const theme = buildTemplateTheme({ '#FF6B00:1.00': 'ACCENT1' }, [{ hex: '#FF6B00', alpha: 1, usageCount: 3 }], { ACCENT1: '#00FF00' });
    expect(theme?.ACCENT1).toEqual({ r: 0, g: 1, b: 0 });
  });

  it('never drifts a default role color through a hex round-trip', () => {
    // #DB (219) back to a float is 0.858823… — DEFAULT_THEME_ROLE_COLORS.ACCENT2's exact 0.86 must survive untouched.
    const theme = buildTemplateTheme({}, [], { ACCENT1: '#00FF00' });
    expect(theme?.ACCENT2).toEqual(DEFAULT_THEME_ROLE_COLORS.ACCENT2);
  });
});

describe('resolveThemeRoleHexes', () => {
  it('falls back to the default hex for every role when nothing is assigned or overridden', () => {
    expect(resolveThemeRoleHexes({}, [])).toEqual(DEFAULT_THEME_ROLE_HEX);
  });

  it('prefers a detected color assigned via colorRoles over the default', () => {
    const hexes = resolveThemeRoleHexes({ '#FF6B00:1.00': 'ACCENT1' }, [{ hex: '#FF6B00', alpha: 1, usageCount: 3 }]);
    expect(hexes.ACCENT1).toBe('#FF6B00');
    expect(hexes.DARK1).toBe(DEFAULT_THEME_ROLE_HEX.DARK1);
  });

  it('prefers a manual override over both the detected color and the default', () => {
    const hexes = resolveThemeRoleHexes({ '#FF6B00:1.00': 'ACCENT1' }, [{ hex: '#FF6B00', alpha: 1, usageCount: 3 }], { ACCENT1: '#123456' });
    expect(hexes.ACCENT1).toBe('#123456');
  });

  it('covers all 12 theme roles', () => {
    expect(Object.keys(resolveThemeRoleHexes({}, []))).toEqual(THEME_ROLES);
  });
});

describe('applyThemeRolesToElements', () => {
  it('returns the same array reference when no role is assigned (cheap no-op for deck export)', () => {
    const elements: IRElement[] = [baseShape()];
    expect(applyThemeRolesToElements(elements, {})).toBe(elements);
  });

  it('tags a matching shape fill and stroke color with the assigned role', () => {
    const elements: IRElement[] = [
      baseShape({
        fill: { type: 'SOLID', color: { r: 1, g: 0.4196078431372549, b: 0, a: 1 } },
        stroke: { color: { r: 0, g: 0, b: 0, a: 1 }, weightPt: 1, dash: 'SOLID' },
      }),
    ];
    const [result] = applyThemeRolesToElements(elements, { '#FF6B00:1.00': 'ACCENT1', '#000000:1.00': 'DARK1' }) as IRShape[];
    expect(result.fill?.color.themeRole).toBe('ACCENT1');
    expect(result.stroke?.color.themeRole).toBe('DARK1');
  });

  it('tags a matching line stroke color', () => {
    const [result] = applyThemeRolesToElements([baseLine()], { '#000000:1.00': 'DARK1' }) as IRLine[];
    expect(result.stroke.color.themeRole).toBe('DARK1');
  });

  it('tags matching text run colors, leaving non-matching runs untouched', () => {
    const elements: IRElement[] = [
      baseText({
        runs: [
          { start: 0, end: 2, fontFamily: 'Inter', fontWeight: 400, italic: false, fontSizePx: 16, color: { r: 0, g: 0, b: 0, a: 1 } },
          { start: 2, end: 5, fontFamily: 'Inter', fontWeight: 400, italic: false, fontSizePx: 16, color: { r: 1, g: 1, b: 1, a: 1 } },
        ],
      }),
    ];
    const [result] = applyThemeRolesToElements(elements, { '#000000:1.00': 'DARK1' }) as IRText[];
    expect(result.runs[0].color.themeRole).toBe('DARK1');
    expect(result.runs[1].color.themeRole).toBeUndefined();
  });

  it('never mutates the input elements (pure, like the rest of serialize/)', () => {
    const original = baseShape({ fill: { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } } });
    applyThemeRolesToElements([original], { '#000000:1.00': 'DARK1' });
    expect(original.fill?.color.themeRole).toBeUndefined();
  });

  it('leaves images untouched', () => {
    const image: IRElement = {
      kind: 'image',
      id: 'img1',
      sourceNodeId: 'n4',
      rect: { x: 0, y: 0, w: 10, h: 10 },
      rotation: 0,
      opacity: 1,
      assetKey: 'a1',
      isRasterFallback: false,
    };
    expect(applyThemeRolesToElements([image], { '#000000:1.00': 'DARK1' })).toEqual([image]);
  });
});
