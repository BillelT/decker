import type { ThemeColorRole } from '@figma-to-slides/shared';
import { describe, expect, it } from 'vitest';
import { mapThemeBatch, THEME_BATCH_SOURCE_ID } from './theme.js';

const FULL_THEME: Record<ThemeColorRole, { r: number; g: number; b: number }> = {
  DARK1: { r: 0.1, g: 0.1, b: 0.18 },
  LIGHT1: { r: 1, g: 1, b: 1 },
  DARK2: { r: 0.09, g: 0.13, b: 0.24 },
  LIGHT2: { r: 0.96, g: 0.96, b: 0.96 },
  ACCENT1: { r: 1, g: 0.42, b: 0 },
  ACCENT2: { r: 0, g: 0.7, b: 0.85 },
  ACCENT3: { r: 0.48, g: 0.17, b: 0.75 },
  ACCENT4: { r: 0.02, g: 0.84, b: 0.63 },
  ACCENT5: { r: 1, g: 0.84, b: 0.04 },
  ACCENT6: { r: 0.94, g: 0.28, b: 0.44 },
  HYPERLINK: { r: 0.11, g: 0.6, b: 0.67 },
  FOLLOWED_HYPERLINK: { r: 0.42, g: 0.3, b: 0.58 },
};

describe('mapThemeBatch', () => {
  it('targets the Master page, not a slide', () => {
    const batch = mapThemeBatch(FULL_THEME, 'master1');
    expect(batch.requests).toEqual([
      {
        updatePageProperties: {
          objectId: 'master1',
          pageProperties: { colorScheme: { colors: expect.any(Array) } },
          fields: 'colorScheme',
        },
      },
    ]);
  });

  it('uses a sentinel sourceSlideId so runner.ts can label it distinctly from a real slide', () => {
    const batch = mapThemeBatch(FULL_THEME, 'master1');
    expect(batch.sourceSlideId).toBe(THEME_BATCH_SOURCE_ID);
  });

  it('emits all 12 writable ThemeColorType roles, none omitted (Slides ignores missing ones rather than keeping their previous value)', () => {
    const batch = mapThemeBatch(FULL_THEME, 'master1');
    const request = batch.requests[0];
    if (!('updatePageProperties' in request)) throw new Error('expected updatePageProperties');
    const colors = request.updatePageProperties.pageProperties.colorScheme.colors;
    expect(colors).toHaveLength(12);
    expect(colors.map((c) => c.type).sort()).toEqual(Object.keys(FULL_THEME).sort());
  });

  it('clamps out-of-range color components like the rest of the mapper', () => {
    const theme = { ...FULL_THEME, ACCENT1: { r: 1.5, g: -0.3, b: 0.5 } };
    const batch = mapThemeBatch(theme, 'master1');
    const request = batch.requests[0];
    if (!('updatePageProperties' in request)) throw new Error('expected updatePageProperties');
    const accent1 = request.updatePageProperties.pageProperties.colorScheme.colors.find((c) => c.type === 'ACCENT1');
    expect(accent1?.color).toEqual({ red: 1, green: 0, blue: 0.5 });
  });
});
