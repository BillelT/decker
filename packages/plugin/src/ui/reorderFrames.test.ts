import { describe, expect, it } from 'vitest';
import { moveToIndex } from './reorderFrames.js';

describe('moveToIndex', () => {
  it('moves an element forward to a later index', () => {
    expect(moveToIndex(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an element backward to an earlier index', () => {
    expect(moveToIndex(['a', 'b', 'c', 'd'], 'd', 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('is a no-op when the target index equals the current index', () => {
    expect(moveToIndex(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'b', 'c']);
  });

  it('is a no-op for an unknown id', () => {
    expect(moveToIndex(['a', 'b', 'c'], 'missing', 1)).toEqual(['a', 'b', 'c']);
  });

  it('is a no-op for an out-of-range target index', () => {
    expect(moveToIndex(['a', 'b', 'c'], 'a', 5)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const input = ['a', 'b', 'c'];
    moveToIndex(input, 'a', 2);
    expect(input).toEqual(['a', 'b', 'c']);
  });
});
