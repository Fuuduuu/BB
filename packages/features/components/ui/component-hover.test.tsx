// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import type { BoardDoc } from '@pcbk/domain';
import { bodyOutline } from '@pcbk/domain/geometry';
import { useSessionStore, useViewStore } from '@pcbk/ui';
import { expect, test } from 'vitest';
import { mountMeasurements, pinRef } from '../../measurements/__tests__/workspace';

function seedConnector(doc: BoardDoc) {
  const source = doc.components[0]!;
  doc.components.push({
    ...source,
    id: 'cmp_j29',
    ref: 'J29',
    pins: source.pins.map((pin) => ({ ...pin, uid: `pin_j29_${pin.id}` })),
    board: { ...source.board!, center: { x: 330, y: 100 }, rotationDeg: 25 },
  });
}

function setupList() {
  const app = mountMeasurements({ seed: seedConnector });
  fireEvent.click(screen.getByRole('tab', { name: 'Komponendid' }));
  const row = screen.getByRole<HTMLButtonElement>('button', { name: 'Vali J29' });
  return {
    ...app,
    row,
    outline: () => app.svg.querySelector('[data-layer="components.hover"] polygon'),
  };
}

test('list_row_hover_previews_component_without_selecting', () => {
  const { row, outline, engine, clickPin } = setupList();
  clickPin('2');
  const before = useSessionStore.getState().selection;
  expect(outline()).toBeNull();
  fireEvent.pointerEnter(row);
  const contour = outline();
  expect(contour?.getAttribute('stroke-dasharray')).toBeTruthy();
  expect(useSessionStore.getState().selection).toBe(before);

  const { doc } = engine.snapshot();
  const board = doc.components[1]!.board!;
  const original = bodyOutline(board, doc.scale.pxPerMm);
  const expanded = contour!
    .getAttribute('points')!
    .split(' ')
    .map((point) => {
      const [x, y] = point.split(',').map(Number);
      return { x: x!, y: y! };
    });
  for (const index of [1, 3]) {
    const length = (points: typeof original) =>
      Math.hypot(points[index]!.x - points[0]!.x, points[index]!.y - points[0]!.y);
    expect(length(expanded) - length(original)).toBeCloseTo(6);
  }

  fireEvent.pointerLeave(row);
  expect(outline()).toBeNull();
  expect(useSessionStore.getState().selection).toBe(before);
  fireEvent.click(row);
  expect(useSessionStore.getState().selection.items).toEqual([
    { kind: 'component', id: 'cmp_j29' },
  ]);
});

test('keyboard_row_focus_previews_component', () => {
  const { row, outline } = setupList();
  act(() => row.focus());
  expect(document.activeElement).toBe(row);
  expect(outline()).toBeTruthy();
  expect(useSessionStore.getState().selection.items).toEqual([]);
  act(() => row.blur());
  expect(outline()).toBeNull();
});

test('preview_keeps_measure_draft_and_view', () => {
  const { row, outline, clickPin, engine } = setupList();
  const view = { zoom: 1.5, pan: { x: 35, y: 60 } };
  act(() => useViewStore.getState().setBoardView(view));
  clickPin('2');
  const measure = within(screen.getByRole('region', { name: 'Mõõda' }));
  const voltage = measure.getByRole<HTMLInputElement>('textbox', { name: 'Pinge' });
  act(() => voltage.focus());
  fireEvent.change(voltage, { target: { value: '4,98' } });
  fireEvent.pointerEnter(row);
  expect(outline()).toBeTruthy();
  expect(document.activeElement).toBe(voltage);
  expect(voltage.value).toBe('4,98');
  expect(useViewStore.getState().boardView).toEqual(view);
  fireEvent.pointerLeave(row);
  expect(outline()).toBeNull();
  fireEvent.keyDown(voltage, { key: 'Enter' });
  expect(engine.snapshot().doc.measurements).toMatchObject([{ at: pinRef('2'), value: 4.98 }]);
  expect(useViewStore.getState().boardView).toEqual(view);
});

test('closing_the_list_clears_its_preview', () => {
  const { row, outline } = setupList();
  fireEvent.pointerEnter(row);
  expect(outline()).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Teek' }));
  expect(outline()).toBeNull();
});
