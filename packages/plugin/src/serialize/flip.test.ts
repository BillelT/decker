import { describe, expect, it } from 'vitest';
import { isFlippedTransform } from './flip.js';

describe('isFlippedTransform', () => {
  it('does not flag the identity matrix (no rotation, no flip)', () => {
    expect(isFlippedTransform(1, 0, 0, 1)).toBe(false);
  });

  it('does not flag a pure rotation (e.g. 90°)', () => {
    // m00=cos90=0, m10=-sin90=-1, m01=sin90=1, m11=cos90=0
    expect(isFlippedTransform(0, 1, -1, 0)).toBe(false);
  });

  it('flags a pure horizontal flip', () => {
    // H = [[-1, 0], [0, 1]]
    expect(isFlippedTransform(-1, 0, 0, 1)).toBe(true);
  });

  it('flags a pure vertical flip', () => {
    // V = [[1, 0], [0, -1]]
    expect(isFlippedTransform(1, 0, 0, -1)).toBe(true);
  });

  it('flags a flip composed with a rotation (e.g. Figma "Flip Horizontal" then rotate 30°)', () => {
    const cos30 = Math.cos((30 * Math.PI) / 180);
    const sin30 = Math.sin((30 * Math.PI) / 180);
    expect(isFlippedTransform(-cos30, sin30, sin30, cos30)).toBe(true);
  });
});
