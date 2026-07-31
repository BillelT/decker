import { describe, expect, it } from 'vitest';
import { mapPlaceholderAltText, PLACEHOLDER_ALT_TEXT_PREFIX } from './placeholder.js';

describe('mapPlaceholderAltText', () => {
  it('carries the role in a machine-parseable description and the label in a human-readable title', () => {
    const req = mapPlaceholderAltText('el1', { role: 'IMAGE', label: 'Hero photo' });
    expect(req.objectId).toBe('el1');
    expect(req.title).toContain('Hero photo');
    expect(req.description).toBe(`${PLACEHOLDER_ALT_TEXT_PREFIX}:IMAGE`);
  });
});
