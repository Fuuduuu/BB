import { newBoardDoc, type FootprintParams } from '@pcbk/domain';
import { createEngine } from '@pcbk/engine';
import { expect, test } from 'vitest';
import { engineFeatures, RESERVED_FIELDS } from '../engine';

function withSoic14() {
  const doc = newBoardDoc('Plaat');
  const order = [14, 2, 12, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13];
  const customPad = {
    local: { x: -2, y: 4 },
    sizeMm: 1.5,
    shape: 'rect' as const,
    through: false,
  };
  doc.components.push({
    id: 'cmp_a',
    kind: 'ic',
    ref: 'U1',
    marking: 'LM324',
    value: '',
    identified: true,
    dnp: false,
    note: 'Sünteetiline komponent',
    pins: order.map((number) => ({
      id: String(number),
      uid: `pin_original_${number}`,
      ...(number === 12 ? { name: 'VCC' } : {}),
      nc: number === 9,
    })),
    board: {
      footprint: 'soic',
      params: { pins: 14, body: 3.9 },
      center: { x: 27.5, y: -8 },
      rotationDeg: 31.5,
      side: 'bottom',
      labelOffset: { x: -3, y: 6 },
      scaleX: 1.4,
      scaleY: 0.7,
      customPads: { '12': customPad, '14': customPad },
      padMap: { '1': '12', '12': '1', '14': '14' },
    },
  });
  const result = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => '2026-11-15T10:00:00.000Z' },
  });
  result.host.load('area-footprint-test', doc, false);
  const contact = (pin: number) => ({ c: 'cmp_a', p: String(pin), uid: `pin_original_${pin}` });
  for (const [pin, reference] of [
    [12, 14],
    [1, 12],
  ] as const) {
    expect(
      result.engine.execute('measurements.add', {
        id: `msr_${pin}`,
        mode: 'voltage',
        at: contact(pin),
        ref: contact(reference),
        value: 3.3,
        power: 'on',
        takenAt: '2026-11-15T10:00:00.000Z',
      }).ok,
    ).toBe(true);
  }
  return result;
}

const toArea = {
  id: 'cmp_a',
  footprint: 'area',
  params: { w: 22, h: 17 },
  newPinUids: {},
};

test('change_to_area_keeps_all_pins', () => {
  const { engine, host } = withSoic14();
  const before = engine.snapshot();
  const original = before.doc.components[0]!;
  expect(before.derived.pinReadings.pin_original_12?.measurementId).toBe('msr_12');
  expect(before.derived.pinReadings.pin_original_1?.measurementId).toBe('msr_1');
  host.drainJournal();
  expect(engine.execute('components.changeFootprint', toArea)).toMatchObject({ ok: true });
  const area = engine.snapshot();
  expect(area.doc.components[0]).toEqual({
    ...original,
    board: { ...original.board, footprint: 'area', params: { w: 22, h: 17 } },
  });
  expect(area.doc.measurements).toEqual(before.doc.measurements);
  expect(area.derived.pinReadings).toEqual(before.derived.pinReadings);
  expect(area.rev).toBe(before.rev + 1);
  expect(host.drainJournal()).toMatchObject([{ commandId: 'components.changeFootprint' }]);

  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components).toEqual(before.doc.components);
  expect(engine.snapshot().derived.pinReadings).toEqual(before.derived.pinReadings);
  expect(engine.redo().ok).toBe(true);
  expect(engine.snapshot().doc.components).toEqual(area.doc.components);

  expect(
    engine.execute('components.changeFootprint', {
      id: 'cmp_a',
      footprint: 'soic',
      params: { pins: 14 },
      newPinUids: {},
    }),
  ).toMatchObject({ ok: true });
  expect(engine.snapshot().doc.components[0]).toEqual({
    ...original,
    pins: [...original.pins].sort((a, b) => Number(a.id) - Number(b.id)),
  });
  expect(engine.snapshot().doc.measurements).toEqual(before.doc.measurements);
  expect(engine.snapshot().derived.pinReadings).toEqual(before.derived.pinReadings);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components).toEqual(area.doc.components);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components).toEqual(before.doc.components);
});

const invalidAreaParams: FootprintParams[] = [
  { w: 0, h: 17 },
  { w: 22, h: -1 },
  { w: 'invalid', h: 17 },
  { w: 22, h: Infinity },
  { w: 22, h: 17, pins: 14 },
];

test.each(invalidAreaParams)('invalid area still rejects atomically %#', (params) => {
  const { engine, host } = withSoic14();
  const before = engine.snapshot();
  host.drainJournal();
  expect(engine.execute('components.changeFootprint', { ...toArea, params })).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [{ message: 'invalid_footprint' }] },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});
