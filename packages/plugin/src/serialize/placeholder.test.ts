import { describe, expect, it } from 'vitest';
import { CANONICAL_TAG_FOR_ROLE, clearPlaceholderTag, findUnknownPlaceholderTag, parsePlaceholderTag, setPlaceholderTag } from './placeholder.js';

describe('parsePlaceholderTag', () => {
  it('returns undefined for a layer name without a tag', () => {
    expect(parsePlaceholderTag('Rectangle 12')).toBeUndefined();
  });

  it('recognizes a bare role tag with the default label', () => {
    expect(parsePlaceholderTag('[[title]] Main heading')).toEqual({ role: 'TITLE', label: 'Title' });
  });

  it('recognizes a role tag with a custom label', () => {
    expect(parsePlaceholderTag('[[image:Hero photo]] Photo container')).toEqual({ role: 'IMAGE', label: 'Hero photo' });
  });

  it('is case-insensitive on the role and tolerant of internal spacing', () => {
    expect(parsePlaceholderTag('[[ Body : Description ]] Copy block')).toEqual({ role: 'BODY', label: 'Description' });
  });

  it('accepts French aliases', () => {
    expect(parsePlaceholderTag('[[titre]] Titre principal')).toEqual({ role: 'TITLE', label: 'Title' });
    expect(parsePlaceholderTag('[[corps]] Paragraphe')).toEqual({ role: 'BODY', label: 'Body text' });
  });

  it('falls back to the role default label for CUSTOM without a label', () => {
    expect(parsePlaceholderTag('[[custom]] Anything')).toEqual({ role: 'CUSTOM', label: 'Custom placeholder' });
  });

  it('returns undefined for an unknown role keyword', () => {
    expect(parsePlaceholderTag('[[unknown]] Something')).toBeUndefined();
  });

  it('ignores a tag that does not appear at the start of the name', () => {
    expect(parsePlaceholderTag('Header [[title]]')).toBeUndefined();
  });
});

describe('findUnknownPlaceholderTag', () => {
  it('returns undefined for a layer name without a tag', () => {
    expect(findUnknownPlaceholderTag('Rectangle 12')).toBeUndefined();
  });

  it('returns undefined for a recognized role tag', () => {
    expect(findUnknownPlaceholderTag('[[title]] Main heading')).toBeUndefined();
    expect(findUnknownPlaceholderTag('[[image:Hero]] Photo')).toBeUndefined();
  });

  it('returns the raw role for a misspelled tag', () => {
    expect(findUnknownPlaceholderTag('[[titel]] Main heading')).toBe('titel');
    expect(findUnknownPlaceholderTag('[[img]] Photo')).toBe('img');
  });

  it('ignores tag-like syntax that does not appear at the start of the name', () => {
    expect(findUnknownPlaceholderTag('Header [[wat]]')).toBeUndefined();
  });
});

describe('setPlaceholderTag', () => {
  it('prepends the tag to a name without one', () => {
    expect(setPlaceholderTag('Main heading', 'title')).toBe('[[title]] Main heading');
  });

  it('replaces an existing valid tag rather than stacking it', () => {
    expect(setPlaceholderTag('[[body]] Main heading', 'title')).toBe('[[title]] Main heading');
  });

  it('replaces an existing unknown/misspelled tag too', () => {
    expect(setPlaceholderTag('[[titel]] Main heading', 'title')).toBe('[[title]] Main heading');
  });

  it('produces a bare tag when the name is empty otherwise', () => {
    expect(setPlaceholderTag('', 'logo')).toBe('[[logo]]');
    expect(setPlaceholderTag('[[logo]]', 'image')).toBe('[[image]]');
  });
});

describe('CANONICAL_TAG_FOR_ROLE', () => {
  it('round-trips through parsePlaceholderTag for every known role', () => {
    for (const tag of ['title', 'subtitle', 'body', 'image', 'logo', 'custom'] as const) {
      const role = parsePlaceholderTag(`[[${tag}]] X`)!.role;
      expect(CANONICAL_TAG_FOR_ROLE[role]).toBeDefined();
      expect(parsePlaceholderTag(`[[${CANONICAL_TAG_FOR_ROLE[role]}]] X`)!.role).toBe(role);
    }
  });
});

describe('clearPlaceholderTag', () => {
  it('removes a valid tag and keeps the rest of the layer name', () => {
    expect(clearPlaceholderTag('[[title]] Main heading')).toBe('Main heading');
  });

  it('removes a misspelled tag too', () => {
    expect(clearPlaceholderTag('[[titel]] Main heading')).toBe('Main heading');
  });

  it('leaves an untagged name untouched', () => {
    expect(clearPlaceholderTag('Main heading')).toBe('Main heading');
  });

  it('never leaves a layer nameless when the tag was the whole name', () => {
    expect(clearPlaceholderTag('[[body]]')).toBe('Body text');
  });

  it('round-trips with setPlaceholderTag', () => {
    expect(clearPlaceholderTag(setPlaceholderTag('Main heading', 'title'))).toBe('Main heading');
  });
});
