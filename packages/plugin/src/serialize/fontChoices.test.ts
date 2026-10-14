import { describe, expect, it } from 'vitest';
import type { IRElement, IRTextRun } from '@figma-to-slides/shared';
import { collectFontSubstitutions, withFontOverrides } from './fontChoices.js';

function run(fontFamily: string, originalFontFamily?: string): IRTextRun {
  return { start: 0, end: 4, fontFamily, fontWeight: 400, italic: false, fontSizePx: 16, color: { r: 0, g: 0, b: 0, a: 1 }, originalFontFamily };
}

function text(...runs: IRTextRun[]): IRElement {
  return { kind: 'text', runs } as unknown as IRElement;
}

describe('collectFontSubstitutions', () => {
  it('lists every font once, the ones Slides has as well as the substituted ones', () => {
    const slide = { elements: [text(run('Inter', 'Cabinet Grotesk'), run('Roboto')), text(run('Roboto'), run('Inter', 'Cabinet Grotesk'))] };
    expect(collectFontSubstitutions(slide)).toEqual([
      { original: 'Cabinet Grotesk', resolved: 'Inter', available: false },
      { original: 'Roboto', resolved: 'Roboto', available: true },
    ]);
  });
});

describe('withFontOverrides', () => {
  it('replaces a font Slides already has, and flags it as substituted for the width margin', () => {
    const slide = { elements: [text(run('Roboto'))] };
    const result = withFontOverrides(slide, { Roboto: 'Lato' });
    const runs = (result.elements[0] as { runs: IRTextRun[] }).runs;
    expect(runs[0].fontFamily).toBe('Lato');
    expect(runs[0].originalFontFamily).toBe('Roboto');
  });

  it('replaces a substituted font by its original family', () => {
    const slide = { elements: [text(run('Inter', 'Cabinet Grotesk'))] };
    const runs = (withFontOverrides(slide, { 'Cabinet Grotesk': 'Poppins' }).elements[0] as { runs: IRTextRun[] }).runs;
    expect(runs[0]).toMatchObject({ fontFamily: 'Poppins', originalFontFamily: 'Cabinet Grotesk' });
  });

  it('leaves the pending slide untouched, so the next export starts from the real fonts', () => {
    const slide = { elements: [text(run('Roboto'))] };
    withFontOverrides(slide, { Roboto: 'Lato' });
    expect((slide.elements[0] as { runs: IRTextRun[] }).runs[0]).toMatchObject({ fontFamily: 'Roboto', originalFontFamily: undefined });
    expect(collectFontSubstitutions(slide)).toEqual([{ original: 'Roboto', resolved: 'Roboto', available: true }]);
  });

  it('keeps a font picked as its own replacement as it is', () => {
    const slide = { elements: [text(run('Roboto'))] };
    const runs = (withFontOverrides(slide, { Roboto: 'Roboto' }).elements[0] as { runs: IRTextRun[] }).runs;
    expect(runs[0].originalFontFamily).toBeUndefined();
  });
});
