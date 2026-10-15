import { describe, expect, it } from 'vitest';
import { suggestColorRoles } from './templateColorRoles.js';
import type { ColorUsage, TemplateColorSwatch } from './templateSummary.js';

function swatch(hex: string, usage: Partial<ColorUsage>, alpha = 1): TemplateColorSwatch {
  return { hex, alpha, usageCount: 1, usage: { frame: 0, text: 0, link: 0, background: 0, fill: 0, stroke: 0, ...usage } };
}

describe('suggestColorRoles', () => {
  it('assigns roles by usage, so a dark palette gets its light text as text color', () => {
    const colors = [
      swatch('#111111', { frame: 4 }),
      swatch('#F5F5F5', { text: 900 }),
      swatch('#999999', { text: 120 }),
      swatch('#222222', { background: 1.5 }),
      swatch('#FF6B00', { fill: 6, text: 20 }),
      swatch('#2D6BFF', { link: 30, fill: 1 }),
      swatch('#00C2A8', { stroke: 2 }),
    ];
    expect(suggestColorRoles(colors, {})).toEqual({
      '#111111:1.00': 'LIGHT1',
      '#F5F5F5:1.00': 'DARK1',
      '#2D6BFF:1.00': 'HYPERLINK',
      '#999999:1.00': 'DARK2',
      '#222222:1.00': 'LIGHT2',
      '#FF6B00:1.00': 'ACCENT1',
      '#00C2A8:1.00': 'ACCENT2',
    });
  });

  it('ranks frame backgrounds by how many layouts use them: 1st and 2nd become the two backgrounds', () => {
    const colors = [
      swatch('#FFFFFF', { frame: 2, background: 3 }),
      swatch('#F28A2E', { frame: 1, fill: 2 }),
      swatch('#14110F', { frame: 5, text: 300 }),
      swatch('#F1EDE9', { background: 2 }),
    ];
    const roles = suggestColorRoles(colors, {});
    expect(roles['#14110F:1.00']).toBe('LIGHT1');
    expect(roles['#FFFFFF:1.00']).toBe('LIGHT2');
  });

  it('keeps every role and color already chosen by hand', () => {
    const colors = [swatch('#FFFFFF', { background: 3 }), swatch('#000000', { text: 500 }), swatch('#FF6B00', { fill: 4 })];
    const current = { '#FF6B00:1.00': 'LIGHT1' as const };
    expect(suggestColorRoles(colors, current)).toEqual({ '#FF6B00:1.00': 'LIGHT1', '#000000:1.00': 'DARK1', '#FFFFFF:1.00': 'LIGHT2' });
  });

  it('never makes a gray an accent, nor proposes a semi-transparent color', () => {
    const colors = [swatch('#808080', { fill: 10 }), swatch('#FF0000', { fill: 10 }, 0.5)];
    expect(suggestColorRoles(colors, {})).toEqual({});
  });
});
