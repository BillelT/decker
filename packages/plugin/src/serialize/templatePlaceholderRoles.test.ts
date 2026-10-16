import { describe, expect, it } from 'vitest';
import { suggestPlaceholderRoles, type SuggestableElement } from './templatePlaceholderRoles.js';

function text(id: string, fontSizePx: number, chars: number, y = 0, extra: Partial<SuggestableElement> = {}): SuggestableElement {
  return { sourceNodeId: id, kind: 'text', text: { fontSizePx, chars, paragraphs: 1, y, stat: false }, ...extra };
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

  it('never touches a layer that already has a role, nor repeats a role already present', () => {
    const elements = [text('tagged', 48, 20, 0, { role: 'TITLE' }), text('big', 40, 20, 100), text('small', 14, 20, 300)];
    expect(suggestPlaceholderRoles(elements)).toEqual([{ sourceNodeId: 'big', tag: 'subtitle' }]);
  });

  it('breaks a font size tie by position: the higher text is the title', () => {
    expect(suggestPlaceholderRoles([text('low', 32, 10, 300), text('high', 32, 10, 20)])[0]).toEqual({ sourceNodeId: 'high', tag: 'title' });
  });

  it('tags a big key figure as custom, and takes the title among the other texts', () => {
    const stat: SuggestableElement = { sourceNodeId: 'stat', kind: 'text', text: { fontSizePx: 240, chars: 3, paragraphs: 1, y: 100, stat: true } };
    expect(suggestPlaceholderRoles([stat, text('label', 14, 12, 40), text('caption', 24, 60, 400)])).toEqual([
      { sourceNodeId: 'stat', tag: 'custom' },
      { sourceNodeId: 'caption', tag: 'title' },
      { sourceNodeId: 'label', tag: 'subtitle' },
    ]);
  });

  it('ignores images and empty texts', () => {
    expect(suggestPlaceholderRoles([{ sourceNodeId: 'img', kind: 'image' }, text('empty', 40, 0)])).toEqual([]);
  });
});
