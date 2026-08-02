import { describe, expect, it } from 'vitest';
import { classifyNode, type DecisionInput } from './decisionTree.js';

function base(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    kind: 'RECTANGLE',
    visible: true,
    opacity: 1,
    width: 100,
    height: 50,
    blendMode: 'NORMAL',
    hasVisibleShadowOrBlur: false,
    isMasked: false,
    ...overrides,
  };
}

describe('classifyNode — early exits (spec §3.3 top of tree)', () => {
  it('ignores invisible nodes', () => {
    expect(classifyNode(base({ visible: false }))).toEqual({ action: 'ignore' });
  });

  it('ignores opacity 0', () => {
    expect(classifyNode(base({ opacity: 0 }))).toEqual({ action: 'ignore' });
  });

  it('ignores nodes degenerate in both axes', () => {
    expect(classifyNode(base({ width: 0.3, height: 0.3 }))).toEqual({ action: 'ignore' });
  });

  it('does NOT ignore a zero-height node (e.g. a Figma LINE, whose height is 0 by construction)', () => {
    expect(classifyNode(base({ width: 100, height: 0 }))).not.toEqual({ action: 'ignore' });
  });

  it('rasters non-NORMAL, non-PASS_THROUGH blend modes', () => {
    const d = classifyNode(base({ blendMode: 'MULTIPLY' }));
    expect(d).toMatchObject({ action: 'raster', warningCode: 'BLEND_MODE_RASTERIZED' });
  });

  it('does NOT raster PASS_THROUGH (Figma\'s default blend mode for most layers, not a real custom blend)', () => {
    const d = classifyNode(base({ blendMode: 'PASS_THROUGH', shape: { visibleFillCount: 1, fillIsGradient: false, fillIsImage: false, hasMultipleOrOffCenterStroke: false } }));
    expect(d).toEqual({ action: 'native-shape-preset' });
  });

  it('rasters visible shadow/blur effects', () => {
    const d = classifyNode(base({ hasVisibleShadowOrBlur: true }));
    expect(d).toMatchObject({ action: 'raster', warningCode: 'EFFECT_RASTERIZED' });
  });

  it('rasters masked nodes', () => {
    const d = classifyNode(base({ isMasked: true }));
    expect(d).toMatchObject({ action: 'raster', warningCode: 'MASK_RASTERIZED' });
  });
});

describe('classifyNode — TEXT branch', () => {
  it('goes native by default', () => {
    expect(classifyNode(base({ kind: 'TEXT', text: { fontUnavailable: false, letterSpacingExceedsThreshold: false, hasUnrepresentableMixedStyle: false } }))).toEqual({ action: 'native-text' });
  });

  it('rasters on missing font', () => {
    const d = classifyNode(base({ kind: 'TEXT', text: { fontUnavailable: true, letterSpacingExceedsThreshold: false, hasUnrepresentableMixedStyle: false } }));
    expect(d).toMatchObject({ action: 'raster', warningCode: 'FONT_MISSING' });
  });

  it('rasters on excessive letter-spacing impact', () => {
    const d = classifyNode(base({ kind: 'TEXT', text: { fontUnavailable: false, letterSpacingExceedsThreshold: true, hasUnrepresentableMixedStyle: false } }));
    expect(d).toMatchObject({ action: 'raster', warningCode: 'LETTER_SPACING_LOST' });
  });
});

describe('classifyNode — shape branch', () => {
  it('goes native preset with a simple solid fill', () => {
    const d = classifyNode(base({ kind: 'ELLIPSE', shape: { visibleFillCount: 1, fillIsGradient: false, fillIsImage: false, hasMultipleOrOffCenterStroke: false } }));
    expect(d).toEqual({ action: 'native-shape-preset' });
  });

  it('rasters multiple visible fills', () => {
    const d = classifyNode(base({ shape: { visibleFillCount: 2, fillIsGradient: false, fillIsImage: false, hasMultipleOrOffCenterStroke: false } }));
    expect(d).toMatchObject({ action: 'raster', warningCode: 'MULTIPLE_FILLS_RASTERIZED' });
  });

  it('rasters gradients', () => {
    const d = classifyNode(base({ shape: { visibleFillCount: 1, fillIsGradient: true, fillIsImage: false, hasMultipleOrOffCenterStroke: false } }));
    expect(d).toMatchObject({ action: 'raster', warningCode: 'GRADIENT_RASTERIZED' });
  });

  it('routes image fills to the image path', () => {
    const d = classifyNode(base({ shape: { visibleFillCount: 1, fillIsGradient: false, fillIsImage: true, hasMultipleOrOffCenterStroke: false } }));
    expect(d).toEqual({ action: 'image' });
  });

  it('uses the radius decision for RECTANGLE nodes', () => {
    const d = classifyNode(
      base({
        kind: 'RECTANGLE',
        shape: {
          visibleFillCount: 1,
          fillIsGradient: false,
          fillIsImage: false,
          hasMultipleOrOffCenterStroke: false,
          radiusDecision: { kind: 'round-rectangle', approximated: true },
        },
      }),
    );
    expect(d).toEqual({ action: 'native-shape-round-rectangle', approximated: true });
  });

  it('rasters when the radius decision says raster', () => {
    const d = classifyNode(
      base({
        kind: 'RECTANGLE',
        shape: {
          visibleFillCount: 1,
          fillIsGradient: false,
          fillIsImage: false,
          hasMultipleOrOffCenterStroke: false,
          radiusDecision: { kind: 'raster', reason: 'non-uniform' },
        },
      }),
    );
    expect(d).toMatchObject({ action: 'raster', warningCode: 'CORNER_RADIUS_RASTERIZED' });
  });
});

describe('classifyNode — LINE', () => {
  it('goes native with a single solid stroke and a supported cap', () => {
    const d = classifyNode(
      base({
        kind: 'LINE',
        width: 100,
        height: 0,
        line: { visibleStrokeCount: 1, strokeIsGradient: false, strokeWeightIsMixed: false, hasUnsupportedCap: false },
      }),
    );
    expect(d).toEqual({ action: 'native-line' });
  });

  it('ignores a LINE with no visible stroke (invisible)', () => {
    const d = classifyNode(
      base({
        kind: 'LINE',
        width: 100,
        height: 0,
        line: { visibleStrokeCount: 0, strokeIsGradient: false, strokeWeightIsMixed: false, hasUnsupportedCap: false },
      }),
    );
    expect(d).toEqual({ action: 'ignore' });
  });

  it('rasters a LINE with multiple strokes (Slides supports only one)', () => {
    const d = classifyNode(
      base({
        kind: 'LINE',
        line: { visibleStrokeCount: 2, strokeIsGradient: false, strokeWeightIsMixed: false, hasUnsupportedCap: false },
      }),
    );
    expect(d).toMatchObject({ action: 'raster', warningCode: 'LINE_RASTERIZED' });
  });

  it('rasters a LINE with a gradient stroke', () => {
    const d = classifyNode(
      base({
        kind: 'LINE',
        line: { visibleStrokeCount: 1, strokeIsGradient: true, strokeWeightIsMixed: false, hasUnsupportedCap: false },
      }),
    );
    expect(d).toMatchObject({ action: 'raster', warningCode: 'GRADIENT_RASTERIZED' });
  });

  it('rasters a LINE with mixed stroke weight', () => {
    const d = classifyNode(
      base({
        kind: 'LINE',
        line: { visibleStrokeCount: 1, strokeIsGradient: false, strokeWeightIsMixed: true, hasUnsupportedCap: false },
      }),
    );
    expect(d).toMatchObject({ action: 'raster', warningCode: 'LINE_RASTERIZED' });
  });

  it('rasters a LINE with an unsupported cap (arrow/diamond/circle decoration)', () => {
    const d = classifyNode(
      base({
        kind: 'LINE',
        line: { visibleStrokeCount: 1, strokeIsGradient: false, strokeWeightIsMixed: false, hasUnsupportedCap: true },
      }),
    );
    expect(d).toMatchObject({ action: 'raster', warningCode: 'LINE_RASTERIZED' });
  });
});

describe('classifyNode — vector-like and containers', () => {
  it('always rasters VECTOR_LIKE', () => {
    const d = classifyNode(base({ kind: 'VECTOR_LIKE' }));
    expect(d).toMatchObject({ action: 'raster', warningCode: 'VECTOR_RASTERIZED' });
  });

  it('descends into groups without overflow clipping', () => {
    expect(classifyNode(base({ kind: 'GROUP_LIKE', container: { clipsContentWithOverflow: false } }))).toEqual({ action: 'descend' });
  });

  it('rasters groups that clip content with overflowing children', () => {
    const d = classifyNode(base({ kind: 'GROUP_LIKE', container: { clipsContentWithOverflow: true } }));
    expect(d.action).toBe('raster');
  });

  it('ignores OTHER kinds (SLICE/CONNECTOR/WIDGET)', () => {
    expect(classifyNode(base({ kind: 'OTHER' }))).toEqual({ action: 'ignore' });
  });
});
