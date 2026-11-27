import { assert, expect, test } from 'vitest';
import { bodyLocalOutline, footprintBodyShape, footprintGeometry } from '../footprints';
import { bodyOutline } from '../geometry/board';
import type { BoardPlacement } from '../model/component';

function resistor(id: string, x: number) {
  const board: BoardPlacement = {
    footprint: 'chip',
    params: { size: '0805' },
    center: { x, y: 10 },
    rotationDeg: 0,
    side: 'top',
    scaleX: 1,
    scaleY: 1,
    customPads: {},
  };
  return {
    kind: 'resistor' as const,
    pins: ['1', '2'].map((pinId) => ({ id: pinId, uid: `${id}_${pinId}`, nc: false })),
    board,
  };
}

test('outline_and_symbol_stay_frozen_for_second_consumer', async () => {
  const first = resistor('cmp_first', 10);
  const second = resistor('cmp_second', 30);
  const { footprint, params } = first.board;
  const geometry = footprintGeometry(footprint, params);
  assert(geometry);
  const outline = bodyLocalOutline(geometry.body, footprintBodyShape(footprint));
  const point = outline[0]!;
  const originalX = point.x;
  const secondOutline = bodyOutline(second.board, 10);
  try {
    expect(() => {
      // @ts-expect-error Shared contour points are readonly.
      point.x = originalX + 1;
    }).toThrow(TypeError);
  } finally {
    // Keep the shared cache intact while running this test against the mutable baseline.
    if (point.x !== originalX) Reflect.set(point, 'x', originalX);
  }
  expect(Object.isFrozen(outline)).toBe(true);
  expect(bodyOutline(second.board, 10)).toEqual(secondOutline);

  const { schematicSymbol } = await import('./index');
  const symbol = schematicSymbol(first);
  const secondSymbol = structuredClone(schematicSymbol(second));
  assert(symbol);
  assert(secondSymbol);
  const end = symbol.pins[0]!.end;
  expect(() => {
    // @ts-expect-error Symbol pin endpoints are readonly.
    end.x += 1;
  }).toThrow(TypeError);
  expect(schematicSymbol(second)).toEqual(secondSymbol);
});
