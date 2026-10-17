import { describe, expect, it } from 'vitest';
import { suggestPlaceholderRoles, type SuggestableElement } from './templatePlaceholderRoles.js';

function text(id: string, fontSizePx: number, chars: number, y = 0, extra: Partial<SuggestableElement> = {}): SuggestableElement {
  return { sourceNodeId: id, kind: 'text', text: { fontSizePx, chars, paragraphs: 1, y, stat: false, fixed: false }, ...extra };
}

describe('suggestPlaceholderRoles', () => {
  it('picks the largest text as title, the long one as body, the next largest short one as subtitle', () => {
    const elements = [text('footer', 12, 10, 500), text('body', 16, 240, 200), text('title', 48, 20, 40), text('sub', 24, 50, 120)];
    expect(suggestPlaceholderRoles(elements)).toEqual([
      { sourceNodeId: 'title', tag: 'title' },
      { sourceNodeId: 'body', tag: 'body' },
      { sourceNodeId: 'sub', tag: 'subtitle' },
    ]);
  });

  it('keeps a cover subtitle even when it is the smallest text left', () => {
    expect(suggestPlaceholderRoles([text('title', 64, 20), text('sub', 24, 40, 100)])).toEqual([
      { sourceNodeId: 'title', tag: 'title' },
      { sourceNodeId: 'sub', tag: 'subtitle' },
    ]);
  });

  it('does not turn a small caption into a subtitle', () => {
    const elements = [text('title', 48, 20), text('body', 16, 200, 100), text('caption', 12, 15, 400)];
    expect(suggestPlaceholderRoles(elements).map((s) => s.sourceNodeId)).toEqual(['title', 'body']);
  });

  it('never touches a layer that already has a role, nor suggests a second title', () => {
    const elements = [text('tagged', 48, 20, 0, { role: 'TITLE' }), text('big', 40, 20, 100), text('small', 14, 20, 300)];
    expect(suggestPlaceholderRoles(elements)).toEqual([
      { sourceNodeId: 'big', tag: 'subtitle' },
      { sourceNodeId: 'small', tag: 'body' },
    ]);
  });

  it('breaks a font size tie by position: the higher text is the title', () => {
    expect(suggestPlaceholderRoles([text('low', 32, 10, 300), text('high', 32, 10, 20)])[0]).toEqual({ sourceNodeId: 'high', tag: 'title' });
  });

  it('tags every card of a row: a subtitle and a body each', () => {
    const elements = [
      text('title', 48, 22, 40),
      text('h1', 20, 7, 200), text('d1', 13, 55, 230),
      text('h2', 20, 7, 200), text('d2', 13, 34, 230),
      text('h3', 20, 6, 200), text('d3', 13, 44, 230),
    ];
    expect(suggestPlaceholderRoles(elements).map((s) => s.tag)).toEqual(['title', 'subtitle', 'body', 'subtitle', 'body', 'subtitle', 'body']);
  });

  it('makes a big key figure the title, and another one custom', () => {
    const stat = (id: string, size: number): SuggestableElement => ({ sourceNodeId: id, kind: 'text', text: { fontSizePx: size, chars: 3, paragraphs: 1, y: 100, stat: true, fixed: false } });
    expect(suggestPlaceholderRoles([stat('big', 240), text('line', 24, 60, 300), text('source', 14, 29, 400), stat('small', 64)])).toEqual([
      { sourceNodeId: 'big', tag: 'title' },
      { sourceNodeId: 'line', tag: 'body' },
      { sourceNodeId: 'source', tag: 'body' },
      { sourceNodeId: 'small', tag: 'custom' },
    ]);
  });

  it('tags every image, never a native shape or an empty text', () => {
    expect(
      suggestPlaceholderRoles([{ sourceNodeId: 'img', kind: 'image' }, { sourceNodeId: 'tagged', kind: 'image', role: 'LOGO' }, { sourceNodeId: 'rect', kind: 'shape' }, text('empty', 40, 0)]),
    ).toEqual([{ sourceNodeId: 'img', tag: 'image' }]);
  });
});
