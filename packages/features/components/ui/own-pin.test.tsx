// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import type { BoardDoc } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import { useSessionStore } from '@pcbk/ui';
import { expect, test } from 'vitest';
import { mountMeasurements, pointer } from '../../measurements/__tests__/workspace';

const componentId = 'cmp_u1';
const target = { x: 167, y: 124 };
const onBoardHint = 'Lisa jalg: klõpsa plaadil jala kohal · Esc lõpetab';
const chooseComponentHint = 'Lisa jalg: vali enne komponent · Esc lõpetab';

function seedSoic(doc: BoardDoc) {
  const component = doc.components[0]!;
  component.kind = 'ic';
  component.pins = Array.from({ length: 8 }, (_, index) => ({
    id: String(index + 1),
    uid: `pin_u1_${index + 1}`,
    nc: false,
  }));
  component.board = {
    ...component.board!,
    footprint: 'soic',
    params: {},
    side: 'bottom',
    rotationDeg: 30,
    scaleX: 1.5,
  };
  return component;
}

function mountOwnPins(placement: 'standard' | 'area' | 'unplaced' = 'standard') {
  return mountMeasurements({
    seed(doc) {
      const component = seedSoic(doc);
      if (placement === 'unplaced') delete component.board;
      if (placement === 'area') component.board = { ...component.board!, footprint: 'area' };
    },
  });
}

function click(svg: SVGSVGElement, x = target.x, y = target.y) {
  pointer(svg, 'pointerdown', x, y);
  pointer(svg, 'pointerup', x, y);
}

function selectComponent() {
  act(() =>
    useSessionStore.getState().setSelection({ items: [{ kind: 'component', id: componentId }] }),
  );
}

function activate() {
  fireEvent.keyDown(window, { key: 'j' });
  expect(useSessionStore.getState().toolId).toBe('components.addOwnPin');
}

test('add_own_pin_places_pad_at_click', () => {
  const { svg, engine, clickPin } = mountOwnPins();
  clickPin('2');
  activate();
  click(svg);
  const snapshot = engine.snapshot();
  const component = snapshot.doc.components[0]!;
  const pad = boardPads(component.board!, ['9'], snapshot.doc.scale.pxPerMm)[0]!;
  expect(Math.hypot(pad.at.x - target.x, pad.at.y - target.y)).toBeLessThan(0.01);
  expect(component.board?.customPads['9']?.sizeMm).toBeCloseTo(0.6);
  expect(component.pins.at(-1)).toMatchObject({ id: '9', nc: false });
  expect(useSessionStore.getState().selection.items).toEqual([
    { kind: 'pin', componentId, id: '9' },
  ]);
  expect(screen.getByText(onBoardHint)).toBeTruthy();
  expect(useSessionStore.getState().toolId).toBe('components.addOwnPin');
});

test('own_pin_is_one_undo_step', () => {
  const { svg, engine } = mountOwnPins();
  const before = engine.snapshot();
  selectComponent();
  activate();
  click(svg);
  expect(engine.snapshot().rev).toBe(before.rev + 1);
  expect(engine.snapshot().doc.components[0]!.board!.customPads).toHaveProperty('9');

  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(engine.snapshot().doc.components).toEqual(before.doc.components);
  expect(engine.snapshot().history).toMatchObject({ canUndo: false, canRedo: true });

  fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
  const withPad = engine.snapshot();
  selectComponent();
  const table = within(screen.getByRole('region', { name: 'Jalad' }));
  fireEvent.click(table.getByRole('button', { name: 'Eemalda jalg 9' }));
  expect(engine.snapshot().rev).toBe(withPad.rev + 1);
  expect(engine.snapshot().doc.components).toEqual(before.doc.components);

  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(engine.snapshot().doc.components).toEqual(withPad.doc.components);
});

test('pin_table_add_pin_on_placed_component_starts_own_pin_tool', () => {
  const placed = mountOwnPins();
  selectComponent();
  const before = placed.engine.snapshot();
  fireEvent.click(screen.getByRole('button', { name: 'Lisa jalg' }));
  expect(useSessionStore.getState().toolId).toBe('components.addOwnPin');
  expect(placed.engine.snapshot()).toBe(before);
  expect(screen.getByText(onBoardHint)).toBeTruthy();
  placed.unmount();

  for (const placement of ['unplaced', 'area'] as const) {
    useSessionStore.getState().reset('');
    const app = mountOwnPins(placement);
    selectComponent();
    fireEvent.click(screen.getByRole('button', { name: 'Lisa jalg' }));
    expect(app.engine.snapshot().doc.components[0]!.pins.at(-1)?.id).toBe('9');
    expect(useSessionStore.getState().toolId).toBe('select');
    app.unmount();
  }
});

test('own_pin_tool_selects_then_adds_and_ignores_a_drag', () => {
  const { svg, engine } = mountOwnPins();
  const before = engine.snapshot();
  activate();
  expect(screen.getByText(chooseComponentHint)).toBeTruthy();
  click(svg, 160, 100);
  expect(useSessionStore.getState().selection.items).toEqual([
    { kind: 'component', id: componentId },
  ]);
  expect(engine.snapshot()).toBe(before);
  expect(screen.getByText(onBoardHint)).toBeTruthy();

  pointer(svg, 'pointerdown', target.x, target.y);
  pointer(svg, 'pointermove', target.x + 12, target.y);
  pointer(svg, 'pointerup', target.x, target.y);
  expect(engine.snapshot()).toBe(before);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(useSessionStore.getState().toolId).toBe('select');
  expect(screen.queryByText(onBoardHint)).toBeNull();
  expect(engine.snapshot()).toBe(before);
});
