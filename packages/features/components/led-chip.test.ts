import { expect, test } from 'vitest';
import { footprintGeometry } from '@pcbk/domain/footprints';
import { idGenerator, setup } from '../__tests__/helpers';
import { COMPONENT_LIBRARY, makePlacedComponent } from './contract';

test('led_smd_pads_named_k_and_a_and_chip_stays_unnamed', () => {
  const entry = COMPONENT_LIBRARY.find(({ id }) => id === 'led_smd')!;
  expect(entry.footprint).toBe('chip_led');
  for (const size of ['0603', '0805', '1206']) {
    const led = footprintGeometry('chip_led', { size })!;
    const chip = footprintGeometry('chip', { size })!;
    expect(led.body).toStrictEqual(chip.body);
    expect(led.body.pin1).toBeUndefined();
    expect(
      led.pads.map((pad) => {
        const geometry = { ...pad };
        delete geometry.name;
        return geometry;
      }),
    ).toStrictEqual(chip.pads);
    expect(led.pads.map(({ name }) => name)).toEqual(['K', 'A']);
    expect(chip.pads.every((pad) => !Object.hasOwn(pad, 'name'))).toBe(true);
    const { engine } = setup();
    const params = makePlacedComponent(idGenerator(), entry, { size }, { x: 100, y: 100 });
    expect(engine.execute('components.add', params).ok).toBe(true);
    expect(engine.snapshot().doc.components[0]!.pins.map(({ name }) => name)).toEqual(['K', 'A']);
  }
});

test('chip_led_accepts_only_the_three_prototype_sizes', () => {
  expect(footprintGeometry('chip_led', {})?.pads.map(({ name }) => name)).toEqual(['K', 'A']);
  for (const size of ['0402', '1210', '2010', '2512', 'bad', 805]) {
    expect(footprintGeometry('chip_led', { size }), String(size)).toBeUndefined();
  }
});

test('chip_and_led_swap_preserves_user_names_and_pin_identity', () => {
  const { engine } = setup();
  const entry = COMPONENT_LIBRARY.find(({ id }) => id === 'r_smd')!;
  const added = makePlacedComponent(idGenerator(), entry, {}, { x: 100, y: 100 });
  expect(engine.execute('components.add', added).ok).toBe(true);
  expect(
    engine.execute('components.renamePin', { id: added.id, pinId: '1', name: 'Minu nimi' }).ok,
  ).toBe(true);
  expect(engine.execute('components.setNc', { id: added.id, pinId: '2', nc: true }).ok).toBe(true);
  const before = engine.snapshot().doc.components[0]!.pins;
  for (const footprint of ['chip_led', 'chip']) {
    expect(
      engine.execute('components.changeFootprint', {
        id: added.id,
        footprint,
        params: { size: '0805' },
        newPinUids: {},
      }).ok,
    ).toBe(true);
    expect(engine.snapshot().doc.components[0]!.pins).toStrictEqual(before);
  }
});
