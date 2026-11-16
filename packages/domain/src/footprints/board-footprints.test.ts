import { expect, test } from 'vitest';
import type { BoardPlacement } from '../model/component';
import { boardPads, bodyOutline } from '../geometry/board';

function pointPlacement(type: string): BoardPlacement {
  return {
    footprint: 'point',
    params: { type },
    center: { x: 30, y: 40 },
    side: 'top',
    rotationDeg: 90,
    scaleX: 2,
    scaleY: 3,
    customPads: {},
  };
}
test('point_body_has_no_board_outline_but_preserves_its_pad', () => {
  for (const type of ['tp', 'via', 'pad', 'wire', 'hole']) {
    const placement = pointPlacement(type);
    expect(bodyOutline(placement, 10)).toEqual([]);
    expect(boardPads(placement, ['1'], 10)).toHaveLength(1);
    expect(boardPads(placement, ['1'], 10)[0]?.at).toEqual({ x: 30, y: 40 });
  }
});
test('board_oval_keeps_pad_shape_and_transformed_axes', () => {
  const placement = { ...pointPlacement('tp'), footprint: 'to92', params: {} };
  const pads = boardPads(placement, ['2'], 10);
  expect(pads[0]).toMatchObject({
    pinId: '2',
    shape: 'oval',
    at: { x: 30, y: 40 },
    halfPx: { x: 10.5, y: 22.5 },
    angleDeg: 90,
  });
});
