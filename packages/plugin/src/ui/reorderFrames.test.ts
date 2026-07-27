import { describe, expect, it } from 'vitest';
import { reorderFrames } from './reorderFrames.js';

describe('reorderFrames', () => {
  it('swaps with the previous element when moving up', () => {
    expect(reorderFrames(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
  });

  it('swaps with the next element when moving down', () => {
    expect(reorderFrames(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  it('is a no-op when moving the first element up', () => {
    expect(reorderFrames(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
  });

  it('is a no-op when moving the last element down', () => {
    expect(reorderFrames(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
  });

  it('is a no-op for an unknown id', () => {
    expect(reorderFrames(['a', 'b', 'c'], 'missing', 1)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const input = ['a', 'b', 'c'];
    reorderFrames(input, 'b', -1);
    expect(input).toEqual(['a', 'b', 'c']);
  });
});
