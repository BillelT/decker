import { describe, expect, it } from 'vitest';
import { parsePlaceholderTag } from './placeholder.js';

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
