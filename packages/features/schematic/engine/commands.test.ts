import { newBoardDoc, type Component } from '@pcbk/domain';
import { schematicSymbol } from '@pcbk/domain/schematic';
import { createEngine } from '@pcbk/engine';
import { expect, test } from 'vitest';
import { engineFeatures, RESERVED_FIELDS } from '../../engine';

function component(id: string, ref: string, kind: Component['kind'] = 'resistor'): Component {
  return {
    id,
    ref,
    kind,
    identified: false,
    dnp: false,
    marking: '',
    value: '',
    note: '',
    pins: ['1', '2'].map((pin) => ({ id: pin, uid: `pin_${id}_${pin}`, nc: false })),
  };
}

test('schematic_commands_place_rotate_mirror_remove_in_one_step', () => {
  const first = component('cmp_first', 'R1');
  first.board = {
    footprint: 'area',
    params: {},
    center: { x: 25, y: 30 },
    rotationDeg: 0,
    side: 'top',
    scaleX: 1,
    scaleY: 1,
    customPads: {},
  };
  first.schematic = {
    symbol: 'box',
    at: { x: 0, y: 0 },
    rot: 0,
    mirror: false,
    pinMap: { '1': '2', '2': '1' },
    labelOffset: { x: 1, y: -2 },
  };
  const second = component('cmp_second', 'R2');
  const doc = newBoardDoc('Sünteetilised skeemikomponendid');
  doc.components.push(
    first,
    second,
    component('cmp_via', 'V1', 'via'),
    component('cmp_hole', 'H1', 'hole'),
  );
  doc.connections.push({
    id: 'con_first_second',
    basis: 'visual',
    a: { pin: { c: first.id, p: '1' } },
    b: { pin: { c: second.id, p: '1' } },
  });
  const { engine, host } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => '2026-11-27T10:00:00Z' },
  });
  host.load('schematic-commands-test', doc, false);
  const place = { id: first.id, at: { x: 12.3, y: 7.1 }, rot: 0, mirror: false } as const;

  const firstResult = engine.execute('schematic.place', { items: [place] });
  expect(firstResult.ok, JSON.stringify(firstResult)).toBe(true);
  expect(engine.snapshot().doc.components[0]?.schematic).toEqual({
    ...first.schematic,
    symbol: 'resistor',
    at: { x: 12.7, y: 7.62 },
  });
  const beforeBatch = engine.snapshot().doc.components;
  host.drainJournal();
  expect(
    engine.execute('schematic.place', {
      items: [
        { ...place, rot: 90, mirror: true },
        { ...place, id: second.id, rot: 270, mirror: true },
      ],
    }).ok,
  ).toBe(true);
  const afterBatch = engine.snapshot().doc.components;
  expect(afterBatch[0]?.schematic).toEqual({
    ...beforeBatch[0]?.schematic,
    rot: 90,
    mirror: true,
  });
  expect(afterBatch[1]?.schematic).toMatchObject({ rot: 270, mirror: true });
  expect(host.drainJournal()).toMatchObject([{ commandId: 'schematic.place' }]);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components).toEqual(beforeBatch);
  expect(engine.redo().ok).toBe(true);
  expect(engine.snapshot().doc.components).toEqual(afterBatch);

  expect(engine.execute('schematic.remove', { ids: [first.id] }).ok).toBe(true);
  const withoutPlacement = engine.snapshot();
  expect(withoutPlacement.doc.components[0]?.schematic).toBeUndefined();
  expect(withoutPlacement.doc.components[0]).toEqual({ ...first, schematic: undefined });
  expect(withoutPlacement.doc.connections).toEqual(doc.connections);

  for (const id of ['cmp_via', 'cmp_hole']) {
    expect(engine.execute('schematic.place', { items: [{ ...place, id }] })).toMatchObject({
      ok: false,
      error: { code: 'validation', issues: [{ message: 'no_symbol' }] },
    });
    expect(engine.snapshot()).toBe(withoutPlacement);
  }
  expect(
    engine.execute('schematic.place', {
      items: [
        { ...place, rot: 180 },
        { ...place, id: 'cmp_missing' },
      ],
    }),
  ).toEqual({ ok: false, error: { code: 'not_found', id: 'cmp_missing' } });
  expect(engine.execute('schematic.remove', { ids: [second.id, 'cmp_missing'] })).toEqual({
    ok: false,
    error: { code: 'not_found', id: 'cmp_missing' },
  });
  expect(engine.snapshot()).toBe(withoutPlacement);
});

test('set_symbol_maps_contacts_in_one_step', () => {
  const transistor = component('cmp_transistor', 'Q1', 'npn');
  transistor.pins.push({ id: '3', uid: 'pin_cmp_transistor_3', nc: false });
  transistor.schematic = {
    symbol: 'box',
    at: { x: 10.16, y: 7.62 },
    rot: 90,
    mirror: true,
    labelOffset: { x: 3, y: -2 },
  };
  const resistor = component('cmp_resistor', 'R1');
  resistor.schematic = { symbol: 'resistor', at: { x: 0, y: 0 }, rot: 0, mirror: false };
  const unplaced = component('cmp_unplaced_transistor', 'Q2', 'npn');
  unplaced.pins.push({ id: '3', uid: 'pin_cmp_unplaced_transistor_3', nc: false });

  const doc = newBoardDoc('Sünteetiline jalgade vastavus');
  doc.components.push(transistor, resistor, unplaced);
  const { engine, host } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => '2026-11-28T10:00:00Z' },
  });
  host.load('schematic-pin-map-test', doc, false);
  const current = () => engine.snapshot().doc.components[0]!;
  const pinMap = { B: '2', C: '1', E: '3' };

  expect(schematicSymbol(current())?.id).toBe('box');
  host.drainJournal();
  const setResult = engine.execute('schematic.setSymbol', { id: transistor.id, pinMap });
  expect(setResult.ok, JSON.stringify(setResult)).toBe(true);
  expect(current().schematic).toEqual({ ...transistor.schematic, pinMap });
  expect(schematicSymbol(current())).toMatchObject({
    id: 'npn',
    pins: expect.arrayContaining([expect.objectContaining({ contact: 'B', pinId: '2' })]),
  });
  expect(host.drainJournal()).toMatchObject([{ commandId: 'schematic.setSymbol' }]);
  expect(engine.undo().ok).toBe(true);
  expect(current().schematic).toEqual(transistor.schematic);
  expect(schematicSymbol(current())?.id).toBe('box');
  expect(engine.redo().ok).toBe(true);
  expect(current().schematic?.pinMap).toEqual(pinMap);
  expect(engine.execute('schematic.setSymbol', { id: transistor.id, pinMap: null }).ok).toBe(true);
  expect(current().schematic).toEqual(transistor.schematic);
  expect(schematicSymbol(current())?.id).toBe('box');

  const beforeRejectedCommands = engine.snapshot();
  host.drainJournal();
  const invalidMaps: Record<string, string>[] = [
    { B: '2', C: '1' },
    { B: '2', C: '2', E: '3' },
    { B: '2', C: '1', E: '99' },
    { ...pinMap, spare: '3' },
  ];
  for (const invalidMap of invalidMaps) {
    expect(
      engine.execute('schematic.setSymbol', { id: transistor.id, pinMap: invalidMap }),
    ).toMatchObject({ ok: false, error: { issues: [{ message: 'invalid_pin_map' }] } });
    expect(engine.snapshot()).toBe(beforeRejectedCommands);
  }
  expect(
    engine.execute('schematic.setSymbol', { id: resistor.id, pinMap: { '1': '2', '2': '1' } }),
  ).toMatchObject({ ok: false, error: { issues: [{ message: 'invalid_pin_map' }] } });
  expect(engine.snapshot()).toBe(beforeRejectedCommands);
  expect(engine.execute('schematic.setSymbol', { id: unplaced.id, pinMap })).toMatchObject({
    ok: false,
    error: { issues: [{ message: 'component_not_on_schematic' }] },
  });
  expect(engine.snapshot()).toBe(beforeRejectedCommands);
  expect(host.drainJournal()).toEqual([]);
});
