import { expect, test } from 'vitest';
import { idGenerator, setup } from '../../__tests__/helpers';
import { createComponentsUi } from './index';
import { componentPinHits } from './layers/hits';

test('components_register_component_and_pin_kinds', () => {
  const { engine } = setup();
  const placed = { kind: 'component', id: 'cmp_placed' };
  const unplaced = { kind: 'component', id: 'cmp_unplaced' };
  const missing = { kind: 'component', id: 'cmp_missing' };
  expect(
    engine.execute('components.add', {
      id: placed.id,
      ref: 'R1',
      kind: 'resistor',
      pins: [
        { id: '1', uid: 'pin_placed_1', name: 'VCC' },
        { id: '2', uid: 'pin_placed_2' },
      ],
      board: { footprint: 'chip', center: { x: 80, y: 140 } },
    }).ok,
  ).toBe(true);
  expect(
    engine.execute('components.add', {
      id: unplaced.id,
      ref: 'X1',
      kind: 'other',
      pins: [{ id: '1', uid: 'pin_unplaced_1' }],
    }).ok,
  ).toBe(true);

  const snapshot = engine.snapshot();
  const kinds = createComponentsUi(idGenerator()).selectionKinds!;
  const component = kinds.find(({ kind }) => kind === 'component')!;
  const pin = kinds.find(({ kind }) => kind === 'pin')!;
  const placedPin = { kind: 'pin', componentId: placed.id, id: '1' };
  const unplacedPin = { kind: 'pin', componentId: unplaced.id, id: '1' };
  const missingComponentPin = { kind: 'pin', componentId: missing.id, id: '1' };
  const missingPin = { kind: 'pin', componentId: placed.id, id: '3' };
  const orphanPin = { kind: 'pin', id: '1' };

  expect(component.label(snapshot, placed)).toBe('R1');
  expect(pin.label(snapshot, placedPin)).toBe('R1.VCC');
  expect(pin.label(snapshot, unplacedPin)).toBe('X1.1');
  expect(component.exists?.(snapshot, placed)).toBe(true);
  expect(component.exists?.(snapshot, unplaced)).toBe(true);
  expect(component.exists?.(snapshot, missing)).toBe(false);
  expect(component.moveRef?.(snapshot, placed)).toEqual(placed);
  expect(component.moveRef?.(snapshot, unplaced)).toBeNull();
  expect(component.moveRef?.(snapshot, missing)).toBeNull();
  expect(pin.exists?.(snapshot, placedPin)).toBe(true);
  expect(pin.exists?.(snapshot, unplacedPin)).toBe(true);
  expect(pin.exists?.(snapshot, missingComponentPin)).toBe(false);
  expect(pin.exists?.(snapshot, missingPin)).toBe(false);
  expect(pin.exists?.(snapshot, orphanPin)).toBe(false);
  expect(pin.moveRef).toBeUndefined();
  expect(componentPinHits(snapshot)).toEqual([
    expect.objectContaining({ kind: 'pin', id: '1', componentId: placed.id, moves: placed }),
    expect.objectContaining({ kind: 'pin', id: '2', componentId: placed.id, moves: placed }),
  ]);
});
