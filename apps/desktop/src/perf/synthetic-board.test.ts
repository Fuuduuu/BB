import type { IdGen } from '@pcbk/contracts';
import { footprintGeometry, newBoardDoc, padToBoard } from '@pcbk/domain';
import type { BoardPlacement } from '@pcbk/domain';
import { createEngine } from '@pcbk/engine';
import { engineFeatures, RESERVED_FIELDS } from '@pcbk/features/engine';
import { expect, test } from 'vitest';
import { generateSyntheticBoard } from './synthetic-board';

const at = '2026-11-14T10:00:00.000Z';
function ids(): IdGen {
  let next = 0;
  return { newId: (prefix) => `${prefix}_${++next}` };
}
const generate = (seed = 42) => generateSyntheticBoard({ seed, ids: ids(), at });

test('synthetic_board_has_300_components_3000_pins_1500_measurements', () => {
  const board = generate();
  expect(board.surface).toEqual({ width: 4000, height: 3000 });
  expect(board.components).toHaveLength(300);
  expect(board.components.flatMap((component) => component.pins)).toHaveLength(3000);
  expect(board.measurements).toHaveLength(1500);
  expect(new Set(board.components.map((component) => component.ref)).size).toBe(300);
  expect(board.components.every((component) => /^[RCQUJ]\d+$/.test(component.ref ?? ''))).toBe(
    true,
  );
  expect(new Set(board.components.map((component) => component.board?.footprint))).toEqual(
    new Set(['chip', 'sot23', 'soic', 'header1']),
  );
  expect(new Set(board.components.map((component) => component.board?.rotationDeg))).toEqual(
    new Set([0, 90, 180, 270]),
  );
  expect(board.components.filter((component) => component.board?.side === 'bottom')).toHaveLength(
    30,
  );
  const pins = board.components.flatMap((component) =>
    component.pins.map((pin) => ({ c: component.id, p: pin.id, uid: pin.uid })),
  );
  expect(board.measurements.map((measurement) => measurement.at)).toEqual(
    pins.filter((_, index) => index % 2 === 0),
  );
  expect(
    board.measurements.every(
      (measurement) =>
        measurement.mode === 'voltage' && measurement.power === 'on' && measurement.takenAt === at,
    ),
  ).toBe(true);
  const generatedIds = [
    ...board.components.flatMap((component) => [
      component.id,
      ...component.pins.map((pin) => pin.uid),
    ]),
    ...board.measurements.map((measurement) => measurement.id),
  ];
  expect(new Set(generatedIds).size).toBe(4800);
});

test('synthetic_board_is_deterministic_for_seed', () => {
  expect(generate(71)).toEqual(generate(71));
  expect(generate(71)).not.toEqual(generate(72));
});

test('synthetic_board_components_do_not_overlap', () => {
  const board = generate();
  expect(board.components).toHaveLength(300);
  const scale = newBoardDoc('Test').scale.pxPerMm;
  const bounds = board.components.map((component) => {
    expect(component.board).toBeDefined();
    const placement: BoardPlacement = {
      ...component.board!,
      params: component.board!.params ?? {},
      rotationDeg: component.board!.rotationDeg ?? 0,
      side: component.board!.side ?? 'top',
      scaleX: 1,
      scaleY: 1,
      customPads: {},
    };
    const geometry = footprintGeometry(placement.footprint, placement.params)!;
    expect(geometry).toBeDefined();
    const rectangles = [{ x: 0, y: 0, w: geometry.body.w, h: geometry.body.h }, ...geometry.pads];
    const points = rectangles.flatMap((rect) =>
      [-1, 1].flatMap((x) =>
        [-1, 1].map((y) =>
          padToBoard(
            placement,
            { x: rect.x + (x * rect.w) / 2, y: rect.y + (y * rect.h) / 2 },
            scale,
          ),
        ),
      ),
    );
    return {
      left: Math.min(...points.map((point) => point.x)),
      right: Math.max(...points.map((point) => point.x)),
      top: Math.min(...points.map((point) => point.y)),
      bottom: Math.max(...points.map((point) => point.y)),
    };
  });
  bounds.forEach((rect, index) => {
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(board.surface.width);
    expect(rect.bottom).toBeLessThanOrEqual(board.surface.height);
    for (const other of bounds.slice(index + 1)) {
      expect(
        rect.right <= other.left ||
          other.right <= rect.left ||
          rect.bottom <= other.top ||
          other.bottom <= rect.top,
      ).toBe(true);
    }
  });
});

test('synthetic_board_commands_pass_engine', () => {
  const board = generate();
  const { engine, host } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => at },
  });
  host.load('synthetic-test', newBoardDoc('Sünteetiline'), false);
  for (const component of board.components) {
    expect(engine.execute('components.add', component).ok).toBe(true);
  }
  for (const measurement of board.measurements) {
    const result = engine.execute('measurements.add', measurement);
    expect(result.ok, JSON.stringify(result)).toBe(true);
  }
  expect(engine.snapshot().doc.components).toHaveLength(300);
  expect(engine.snapshot().doc.components.flatMap((component) => component.pins)).toHaveLength(
    3000,
  );
  expect(engine.snapshot().doc.measurements).toHaveLength(1500);
}, 120_000);
