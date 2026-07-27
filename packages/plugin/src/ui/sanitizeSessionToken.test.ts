import { describe, expect, it } from 'vitest';
import { sanitizeSessionToken } from './sanitizeSessionToken.js';

describe('sanitizeSessionToken', () => {
  it('passes through a plain token unchanged', () => {
    expect(sanitizeSessionToken('abc-123-def')).toBe('abc-123-def');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeSessionToken('  abc-123  \n')).toBe('abc-123');
  });

  it('strips surrounding quotes', () => {
    expect(sanitizeSessionToken('"abc-123"')).toBe('abc-123');
  });

  it('extracts sessionToken from a pasted raw JSON body', () => {
    expect(sanitizeSessionToken('{"sessionToken":"abc-123-def"}')).toBe('abc-123-def');
  });

  it('extracts sessionToken from pretty-printed JSON', () => {
    expect(sanitizeSessionToken('{\n  "sessionToken": "abc-123-def"\n}')).toBe('abc-123-def');
  });
});
