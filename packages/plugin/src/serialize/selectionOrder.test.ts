import { describe, expect, it } from 'vitest';
import { nextSelectionOrder, type SelectedFrame } from './selectionOrder.js';

function frame(id: string, x: number, y: number, width = 192, height = 108): SelectedFrame {
  return { id, box: { x, y, width, height } };
}

describe('nextSelectionOrder', () => {
  it('keeps the click order when frames are added one at a time', () => {
    const c = frame('c', 400, 0);
    const a = frame('a', 0, 0);
    const b = frame('b', 200, 0);
    let order = nextSelectionOrder([], [c]);
    order = nextSelectionOrder(order, [c, a]);
    order = nextSelectionOrder(order, [a, b, c]);
    expect(order).toEqual(['c', 'a', 'b']);
  });

  it('reads a single-gesture selection top to bottom, then left to right', () => {
    const order = nextSelectionOrder([], [frame('row2-left', 0, 300), frame('row1-right', 400, 4), frame('row1-left', 0, 0), frame('row2-right', 400, 296)]);
    expect(order).toEqual(['row1-left', 'row1-right', 'row2-left', 'row2-right']);
  });

  it('drops deselected frames and keeps the others in place', () => {
    const order = nextSelectionOrder(['b', 'a', 'c'], [frame('c', 400, 0), frame('b', 200, 0)]);
    expect(order).toEqual(['b', 'c']);
  });

  it('appends a new batch after the frames already selected', () => {
    const order = nextSelectionOrder(['z'], [frame('z', 900, 0), frame('y', 400, 0), frame('x', 0, 0)]);
    expect(order).toEqual(['z', 'x', 'y']);
  });

  it('empties when nothing is selected', () => {
    expect(nextSelectionOrder(['a', 'b'], [])).toEqual([]);
  });
});
