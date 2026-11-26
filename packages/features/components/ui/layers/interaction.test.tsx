// @vitest-environment jsdom
import { act, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { boardPads } from '@pcbk/domain/geometry';
import { bindHistoryKeys, useSessionStore } from '@pcbk/ui';
import type { SceneTransform } from '@pcbk/ui';
import { beginAlignment, click, id, mount, pointer, reset } from '../__tests__/interaction-fixture';

const component = { kind: 'component', id };
const labelOffset = { x: 60, y: -40 };
const labelAt = { x: 160, y: 40 };

afterEach(reset);

test('align_is_one_undo_step', () => {
  const { svg, engine, execute, getByRole } = mount();
  const before = engine.snapshot();
  beginAlignment(svg);
  click(svg, 110, 80);
  expect(svg.querySelectorAll('[data-align-target]')).toHaveLength(2);
  pointer(svg, 'pointermove', 180, 140);
  expect(getByRole('status').textContent).toContain('jala 2 kohta fotol');
  expect(svg.querySelectorAll('[data-align-pin]')).toHaveLength(2);
  expect(svg.querySelectorAll('[data-align-target]')).toHaveLength(2);
  expect(
    svg.querySelectorAll('[data-layer="components.align"] line[stroke-dasharray]'),
  ).toHaveLength(2);
  expect(engine.snapshot()).toBe(before);
  expect(execute).not.toHaveBeenCalled();

  click(svg, 180, 140);
  expect(execute).toHaveBeenCalledTimes(1);
  expect(execute.mock.lastCall?.[0]).toBe('components.align');
  expect(getByRole('status').textContent).toContain('vali jalg 1');
  expect(useSessionStore.getState().selection.items).toEqual([component]);
  const board = engine.snapshot().doc.components[0]!.board!;
  const [a, b] = boardPads(board, ['1', '2'], 10);
  expect(a!.at.x).toBeCloseTo(180);
  expect(a!.at.y).toBeCloseTo(120);
  expect(b!.at.x).toBeCloseTo(180);
  expect(b!.at.y).toBeCloseTo(140);

  const unbind = bindHistoryKeys(window, { undo: () => engine.undo(), redo: () => engine.redo() });
  try {
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(engine.snapshot().doc).toEqual({ ...before.doc, rev: before.doc.rev + 2 });
    expect(engine.snapshot().history).toMatchObject({ canUndo: false, canRedo: true });
  } finally {
    unbind();
  }
});

test('align_cancel_with_escape_changes_nothing', () => {
  const { svg, engine, execute, queryByRole } = mount();
  const before = engine.snapshot();
  beginAlignment(svg);
  click(svg, 110, 80);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(queryByRole('status')).toBeNull();
  expect(svg.querySelector('[data-layer="components.align"]')).toBeNull();
  expect(engine.snapshot()).toBe(before);
  expect(execute).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: 'a' });
  expect(queryByRole('status')?.textContent).toContain('vali jalg 1');
});

test('align_uses_the_physical_pad_clicked_on_a_multi_pad_pin', () => {
  const { svg, engine } = mount({
    padMap: { '2': '1' },
    customPads: { '2': { local: { x: 0, y: 2 }, sizeMm: 1, shape: 'circle', through: false } },
  });
  fireEvent.keyDown(window, { key: 'a' });
  click(svg, 110, 80);
  click(svg, 180, 120);
  click(svg, 100, 100);
  click(svg, 170, 140);
  const board = engine.snapshot().doc.components[0]!.board!;
  const [, chosen, other] = boardPads(board, ['1', '2'], 10);
  expect(chosen?.at).toEqual({ x: 180, y: 120 });
  expect(other?.at).toEqual({ x: 170, y: 140 });
});

const scaleQuestion = 'Kas kasutada seda korpust mõõtkava aluseks?';

test('scale_question_closes_when_basis_changes', () => {
  const proposed = 'Uus mõõtkava: 20,00 px/mm';
  function mountQuestion() {
    const board = mount();
    beginAlignment(board.svg);
    click(board.svg, 110, 80);
    click(board.svg, 180, 160);
    expect(board.execute.mock.lastCall?.[0]).toBe('components.align');
    expect(board.getByRole('dialog', { name: scaleQuestion }).textContent).toContain(proposed);
    return board;
  }

  const rotated = mountQuestion();
  act(() => {
    expect(rotated.engine.execute('components.rotate', { ids: [id], deltaDeg: 90 }).ok).toBe(true);
  });
  expect(rotated.getByRole('dialog', { name: scaleQuestion }).textContent).toContain(proposed);
  fireEvent.click(rotated.getByRole('button', { name: 'Kasuta mõõtkavaks' }));
  expect.soft(rotated.execute.mock.lastCall).toMatchObject(['components.scaleFromPins', { mm: 2 }]);
  expect(rotated.engine.snapshot().doc.scale.pxPerMm).toBe(20);
  rotated.unmount();

  const changed = mountQuestion();
  act(() => {
    expect(
      changed.engine.execute('components.changeFootprint', {
        id,
        footprint: 'chip',
        params: { size: '1206' },
        newPinUids: {},
      }).ok,
    ).toBe(true);
  });
  expect.soft(Boolean(changed.queryByRole('dialog', { name: scaleQuestion }))).toBe(false);
  fireEvent.keyDown(changed.svg, { key: 'Enter' });
  expect.soft(changed.execute.mock.calls.map(([command]) => command)).toEqual(['components.align']);
  expect.soft(changed.engine.snapshot().doc.scale.pxPerMm).toBe(10);
  changed.unmount();

  const removed = mountQuestion();
  act(() => {
    expect(removed.engine.execute('items.delete', { ids: [id] }).ok).toBe(true);
  });
  expect.soft(Boolean(removed.queryByRole('dialog', { name: scaleQuestion }))).toBe(false);
  expect(removed.getByRole('status').textContent).toContain('vali jalg 1');
});

test('align_own_pins_offer_no_scale_question', () => {
  const { svg, engine, execute, queryByRole, getByRole } = mount(
    {
      footprint: 'area',
      params: {},
      center: { x: 170, y: 100 },
      customPads: {
        '1': { local: { x: -2, y: 0 }, sizeMm: 1, shape: 'circle', through: false },
        '2': { local: { x: 2, y: 0 }, sizeMm: 1, shape: 'circle', through: false },
      },
    },
    1,
    'none',
    false,
  );
  fireEvent.keyDown(window, { key: 'a' });
  click(svg, 150, 100);
  click(svg, 300, 300);
  click(svg, 190, 100);
  click(svg, 380, 300);
  expect(execute.mock.calls.map(([command]) => command)).toEqual(['components.align']);
  expect(engine.snapshot().doc.scale).toMatchObject({ pxPerMm: 10, calibrated: false });
  expect.soft(Boolean(queryByRole('dialog', { name: scaleQuestion }))).toBe(false);
  expect(getByRole('status').textContent).toContain('vali jalg 1');
});

test('align_out_of_range_proposal_explains_and_keeps_alignment', () => {
  const center = { x: 1000, y: 1000 };
  const { svg, engine, execute, queryByRole, getByRole } = mount(
    { center },
    0.1,
    'none',
    true,
    800,
  );
  const before = engine.snapshot().doc;
  fireEvent.keyDown(window, { key: 'a' });
  click(svg, 20, 100);
  click(svg, 50, 300);
  click(svg, 180, 100);
  click(svg, 290, 300);
  const aligned = engine.snapshot().doc;
  expect(execute.mock.calls.map(([command]) => command)).toEqual(['components.align']);
  expect(aligned.rev).toBe(before.rev + 1);
  expect(aligned.components[0]!.board!.scaleX).toBeCloseTo(1.5);
  expect(aligned.scale.pxPerMm).toBe(800);
  expect(queryByRole('dialog', { name: scaleQuestion })).toBeNull();
  const status = getByRole('status');
  expect(status.getAttribute('data-align-step')).toBe('1');
  expect
    .soft(status.textContent)
    .toBe('Selle korpuse järgi jääks mõõtkava lubatud vahemikust (0,1–1000 px/mm) välja.');

  act(() => {
    expect(engine.undo().ok).toBe(true);
  });
  expect(engine.snapshot().doc.components[0]!.board).toMatchObject({ center, scaleX: 1 });
});

test('align_scale_uses_clicked_pad_on_dense_board', () => {
  const zoom = 0.25;
  const { svg, container, engine, execute, getByRole } = mount({}, zoom, 'none', false);
  const qfnId = 'cmp_qfn';
  act(() => {
    expect(
      engine.execute('components.add', {
        id: qfnId,
        kind: 'ic',
        pins: Array.from({ length: 33 }, (_, index) => ({
          id: String(index + 1),
          uid: `pin_qfn_${index + 1}`,
        })),
        board: {
          footprint: 'qfn',
          params: { pins: 32, pitch: 0.5, ep: 'jah', body: 0 },
          center: { x: 400, y: 300 },
        },
      }).ok,
    ).toBe(true);
  });
  fireEvent.keyDown(window, { key: 'a' });
  click(svg, 387 * zoom, 302.5 * zoom);
  click(svg, 100 * zoom, 100 * zoom);
  click(svg, 422.5 * zoom, 317.5 * zoom);
  click(svg, 157.01 * zoom, 100 * zoom);
  expect(getByRole('dialog', { name: scaleQuestion })).toBeTruthy();

  const outsideButton = document.createElement('button');
  container.append(outsideButton);
  outsideButton.focus();
  expect.soft(fireEvent.keyDown(outsideButton, { key: 'Enter', cancelable: true })).toBe(true);
  expect.soft(engine.snapshot().doc.scale.pxPerMm).toBe(10);

  fireEvent.keyDown(svg, { key: 'Enter' });
  expect(execute.mock.lastCall).toMatchObject([
    'components.scaleFromPins',
    { id: qfnId, pinA: { id: '33' }, pinB: { id: '17' } },
  ]);
  const { scale, components } = engine.snapshot().doc;
  expect(Math.abs(scale.pxPerMm - 20)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(scale.calib!.mm - 2.85)).toBeLessThanOrEqual(0.005);
  const board = components.find((item) => item.id === qfnId)!.board!;
  const [ep] = boardPads(board, ['33'], scale.pxPerMm);
  expect(Math.hypot(ep!.at.x - 100, ep!.at.y - 100)).toBeLessThanOrEqual(0.01);
});

test('align_question_after_applied_alignment', () => {
  const { svg, engine, execute, getByRole, queryByRole } = mount();
  const before = engine.snapshot().doc;
  beginAlignment(svg);
  click(svg, 110, 80);
  click(svg, 180, 130);
  expect(execute.mock.calls.map(([command]) => command)).toEqual(['components.align']);
  const aligned = engine.snapshot().doc;
  expect(aligned.scale.pxPerMm).toBe(10);
  expect(aligned.components[0]!.board).toMatchObject({ scaleX: 0.5, scaleY: 0.5 });

  const dialog = getByRole('dialog', { name: scaleQuestion });
  expect(dialog.textContent).toContain(
    'Korpus on fotol 2,0 korda väiksem kui praeguse mõõtkava järgi.',
  );
  expect(dialog.textContent).toContain('Uus mõõtkava: 5,00 px/mm');
  const useButton = getByRole('button', { name: 'Kasuta mõõtkavaks' });
  expect(document.activeElement).toBe(useButton);
  fireEvent.click(useButton);

  expect(execute.mock.calls.map(([command]) => command)).toEqual([
    'components.align',
    'components.scaleFromPins',
  ]);
  const scaled = engine.snapshot().doc;
  expect(scaled.scale).toMatchObject({ pxPerMm: 5, calibrated: true });
  const board = scaled.components[0]!.board!;
  expect(board).toMatchObject({ scaleX: 1, scaleY: 1 });
  const [a, b] = boardPads(board, ['1', '2'], 5);
  expect(a!.at.x).toBeCloseTo(180);
  expect(a!.at.y).toBeCloseTo(120);
  expect(b!.at.x).toBeCloseTo(180);
  expect(b!.at.y).toBeCloseTo(130);
  expect(queryByRole('dialog', { name: scaleQuestion })).toBeNull();
  expect(getByRole('status').textContent).toContain('vali jalg 1');

  const unbind = bindHistoryKeys(window, { undo: () => engine.undo(), redo: () => engine.redo() });
  try {
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(engine.snapshot().doc).toEqual({ ...aligned, rev: before.rev + 3 });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(engine.snapshot().doc).toEqual({ ...before, rev: before.rev + 4 });
  } finally {
    unbind();
  }
});

test('align_question_replaces_out_of_range_error', () => {
  const { svg, engine, execute, getByRole, queryByRole } = mount();
  const before = engine.snapshot();
  beginAlignment(svg);
  click(svg, 110, 80);
  click(svg, 330, 120);

  const dialog = getByRole('dialog', { name: scaleQuestion });
  expect(dialog.textContent).toContain(
    'Korpus on fotol 7,5 korda suurem kui praeguse mõõtkava järgi.',
  );
  expect(dialog.textContent).toContain('Uus mõõtkava: 75,00 px/mm');
  expect(queryByRole('status')?.textContent ?? '').not.toContain('mõõtkava lubatud vahemikust');
  expect(engine.snapshot()).toBe(before);
  expect(execute).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(queryByRole('dialog', { name: scaleQuestion })).toBeNull();
  expect(useSessionStore.getState().toolId).not.toBe('components.align');
  expect(engine.snapshot()).toBe(before);
  expect(execute).not.toHaveBeenCalled();

  beginAlignment(svg);
  click(svg, 110, 80);
  click(svg, 330, 120);
  getByRole('dialog', { name: scaleQuestion });
  fireEvent.keyDown(svg, { key: 'Enter' });
  expect(execute.mock.calls.map(([command]) => command)).toEqual(['components.scaleFromPins']);
  const scaled = engine.snapshot().doc;
  expect(scaled.scale.pxPerMm).toBe(75);
  const [a, b] = boardPads(scaled.components[0]!.board!, ['1', '2'], 75);
  expect(a!.at).toEqual({ x: 180, y: 120 });
  expect(b!.at).toEqual({ x: 330, y: 120 });

  const unbind = bindHistoryKeys(window, { undo: () => engine.undo(), redo: () => engine.redo() });
  try {
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(engine.snapshot().doc).toEqual({ ...before.doc, rev: before.doc.rev + 2 });
  } finally {
    unbind();
  }
});

test('align_question_on_uncalibrated_photo', () => {
  const uncalibrated = mount({}, 1, 'none', false);
  beginAlignment(uncalibrated.svg);
  click(uncalibrated.svg, 110, 80);
  click(uncalibrated.svg, 180, 140);
  expect(uncalibrated.execute.mock.calls.map(([command]) => command)).toEqual(['components.align']);

  const dialog = uncalibrated.getByRole('dialog', { name: scaleQuestion });
  expect(dialog.textContent).toContain('Foto on kalibreerimata.');
  expect(dialog.textContent).toContain('Uus mõõtkava: 10,00 px/mm');
  expect(dialog.textContent).not.toContain('korda');
  fireEvent.click(uncalibrated.getByRole('button', { name: 'Jäta nii' }));
  expect(uncalibrated.execute).toHaveBeenCalledTimes(1);
  expect(uncalibrated.queryByRole('dialog', { name: scaleQuestion })).toBeNull();
  expect(uncalibrated.getByRole('status').textContent).toContain('vali jalg 1');
  const doc = uncalibrated.engine.snapshot().doc;
  expect(doc.scale).toMatchObject({ pxPerMm: 10, calibrated: false });
  const board = doc.components[0]!.board!;
  expect(board).toMatchObject({ scaleX: 1, scaleY: 1 });
  const [a, b] = boardPads(board, ['1', '2'], 10);
  expect(a!.at.x).toBeCloseTo(180);
  expect(a!.at.y).toBeCloseTo(120);
  expect(b!.at.x).toBeCloseTo(180);
  expect(b!.at.y).toBeCloseTo(140);

  uncalibrated.unmount();
  const calibrated = mount();
  beginAlignment(calibrated.svg);
  click(calibrated.svg, 110, 80);
  click(calibrated.svg, 180, 142);
  expect(calibrated.execute.mock.calls.map(([command]) => command)).toEqual(['components.align']);
  expect(calibrated.queryByRole('dialog', { name: scaleQuestion })).toBeNull();
});

test('align_uses_a_five_screen_pixel_target_limit', () => {
  const { svg, execute, getByRole } = mount({}, 2);
  beginAlignment(svg, 2);
  click(svg, 220, 160);
  click(svg, 364, 240);
  expect(getByRole('status').textContent).toContain('Sihtpunktid on liiga lähestikku');
  expect(execute).not.toHaveBeenCalled();
});

test('align_rejects_a_pin_from_another_component_and_resets_on_session_change', () => {
  const { svg, engine, registry, getByRole } = mount();
  act(() => {
    expect(
      engine.execute('components.add', {
        id: 'cmp_other',
        kind: 'resistor',
        pins: [
          { id: '1', uid: 'pin_other_1' },
          { id: '2', uid: 'pin_other_2' },
        ],
        board: { footprint: 'chip', params: { size: '0805' }, center: { x: 250, y: 80 } },
      }).ok,
    ).toBe(true);
  });
  beginAlignment(svg);
  click(svg, 240, 80);
  expect(getByRole('status').textContent).toContain('samalt komponendilt');
  expect(svg.querySelectorAll('[data-align-pin]')).toHaveLength(1);
  click(svg, 110, 80);
  expect(getByRole('status').textContent).toContain('jala 2 kohta fotol');
  act(() => registry.resetSession());
  expect(getByRole('status').textContent).toContain('vali jalg 1');
  expect(svg.querySelector('[data-layer="components.align"]')).toBeNull();
});

const area = { footprint: 'area', params: {} };

function selectComponent() {
  act(() => useSessionStore.getState().setSelection({ items: [component] }));
}

function scaleHandle(svg: SVGSVGElement, handle: string) {
  const node = svg.querySelector<SVGRectElement>(`[data-scale-handle="${handle}"]`);
  if (!node) throw new Error(`Expected visible scale handle ${handle}`);
  return {
    x: Number(node.getAttribute('x')) + Number(node.getAttribute('width')) / 2,
    y: Number(node.getAttribute('y')) + Number(node.getAttribute('height')) / 2,
  };
}

function dragHandle(svg: SVGSVGElement, handle: string, dx: number, dy: number) {
  const at = scaleHandle(svg, handle);
  pointer(svg, 'pointerdown', at.x, at.y);
  pointer(svg, 'pointermove', at.x + dx, at.y + dy);
  pointer(svg, 'pointerup', at.x + dx, at.y + dy);
}

test('corner_handle_scales_uniformly', () => {
  for (const { rotationDeg, side, dx, dy } of [
    { rotationDeg: 0, side: 'top', dx: 20, dy: 20 },
    { rotationDeg: 90, side: 'top', dx: -20, dy: 20 },
    { rotationDeg: 90, side: 'bottom', dx: -20, dy: -20 },
  ] as const) {
    const { svg, engine } = mount({ ...area, scaleY: 0.8, rotationDeg, side });
    selectComponent();
    dragHandle(svg, 'se', dx, dy);
    const board = engine.snapshot().doc.components[0]!.board!;
    expect(board.scaleX).toBeCloseTo(1.5);
    expect(board.scaleY).toBeCloseTo(1.2);
    cleanup();
  }
});

test('side_handle_scales_one_axis', () => {
  const { svg, engine } = mount({ ...area, rotationDeg: 90, side: 'bottom' });
  selectComponent();
  dragHandle(svg, 'e', 15, -20);
  expect(engine.snapshot().doc.components[0]!.board).toMatchObject({ scaleX: 1.5, scaleY: 1 });
});

test('scale_is_one_undo_step', () => {
  const { svg, engine, execute } = mount(area);
  const before = engine.snapshot().doc.components[0]!.board!;
  selectComponent();
  const at = scaleHandle(svg, 'e');
  pointer(svg, 'pointerdown', at.x, at.y);
  pointer(svg, 'pointermove', at.x + 20, at.y);
  expect(useSessionStore.getState().preview).toMatchObject({ owner: 'components.scale' });
  expect(engine.snapshot().doc.components[0]!.board).toBe(before);
  expect(execute).not.toHaveBeenCalled();
  expect(scaleHandle(svg, 'e').x).toBeCloseTo(at.x + 20);
  pointer(svg, 'pointerup', at.x + 20, at.y);
  expect(execute).toHaveBeenCalledExactlyOnceWith('components.setScale', {
    id,
    scaleX: 1.5,
    scaleY: 1,
  });
  expect(engine.snapshot().doc.components[0]!.board?.center).toEqual(before.center);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components[0]!.board).toEqual(before);
});

test('scale_clamped_to_schema_limits', () => {
  const { svg, engine } = mount({ ...area, scaleY: 0.5 });
  selectComponent();
  dragHandle(svg, 'se', 1000, 1000);
  expect(engine.snapshot().doc.components[0]!.board).toMatchObject({ scaleX: 5, scaleY: 2.5 });
  dragHandle(svg, 'se', -1000, -1000);
  expect(engine.snapshot().doc.components[0]!.board).toMatchObject({ scaleX: 0.4, scaleY: 0.2 });
});

test('scale_handles_are_available_only_for_one_selected_component', () => {
  const { svg, engine, layers } = mount(area, 2);
  const handles = () => svg.querySelectorAll('[data-scale-handle]');
  expect(handles()).toHaveLength(0);
  selectComponent();
  expect(handles()).toHaveLength(8);
  expect(Number(handles()[0]?.getAttribute('width')) * 2).toBe(8);
  const layer = layers.find(({ id }) => id === 'components.handles');
  expect(layer?.hits?.(engine.snapshot(), 2, 'none')).toHaveLength(8);
  act(() =>
    useSessionStore
      .getState()
      .setSelection({ items: [component, { kind: 'component', id: 'other' }] }),
  );
  expect(handles()).toHaveLength(0);
  expect(layer?.hits?.(engine.snapshot(), 2, 'none')).toEqual([]);
});

test('rotated_component_pin_hit_selects_that_pin', () => {
  const { svg } = mount({ rotationDeg: 90 });
  // 0805 pin 1 is 1 mm left of the center before the 90-degree rotation.
  click(svg, 100, 70);
  expect(useSessionStore.getState().selection.items).toEqual([
    { kind: 'pin', id: '1', componentId: id },
  ]);
});

test.each([
  { placement: { labelOffset }, at: labelAt, expectedOffset: { x: 68, y: -43 } },
  { placement: {}, at: { x: 100, y: 41.05 }, expectedOffset: { x: 8, y: -41.95 } },
])('label_drag_outside_body_changes_only_label_offset %#', ({ placement, at, expectedOffset }) => {
  const { svg, engine, execute } = mount(placement);
  const before = engine.snapshot().doc.components[0]!;
  pointer(svg, 'pointerdown', at.x, at.y);
  pointer(svg, 'pointermove', at.x + 7, at.y - 4);
  expect(useSessionStore.getState().preview).toEqual({
    owner: 'components.label',
    data: { id, dx: 7, dy: -4 },
  });
  expect(engine.snapshot().doc.components[0]).toBe(before);
  expect(execute).not.toHaveBeenCalled();

  pointer(svg, 'pointerup', at.x + 8, at.y - 3);
  expect(execute).toHaveBeenCalledExactlyOnceWith('components.setLabelOffset', {
    id,
    offset: expectedOffset,
  });
  expect(engine.snapshot().doc.components[0]).toEqual({
    ...before,
    board: { ...before.board, labelOffset: expectedOffset },
  });
  expect(useSessionStore.getState().preview).toBeNull();
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.components[0]).toEqual(before);
});

test('hidden_label_has_no_hit_area', () => {
  const { engine, layers } = mount({ labelOffset }, 0.4);
  const labelLayer = layers.find((layer) => layer.id === 'components.labels');
  expect(labelLayer).toBeDefined();
  expect(labelLayer!.hits?.(engine.snapshot(), 0.4, 'none')).toEqual([]);
  expect(labelLayer!.hits?.(engine.snapshot(), 0.5, 'none')).toHaveLength(1);
});

test('label_click_selects_component', () => {
  const { svg, execute } = mount({ labelOffset });
  pointer(svg, 'pointerdown', labelAt.x, labelAt.y);
  expect(useSessionStore.getState().selection.items).toEqual([]);
  pointer(svg, 'pointerup', labelAt.x, labelAt.y);
  expect(useSessionStore.getState().selection.items).toEqual([component]);
  expect(execute).not.toHaveBeenCalled();
});

test('label_hit_area_matches_screen_text_under_all_8_transforms', () => {
  const transforms = {
    none: [1, 0, 0, 1],
    rot90: [0, 1, -1, 0],
    rot180: [-1, 0, 0, -1],
    rot270: [0, -1, 1, 0],
    mirror: [-1, 0, 0, 1],
    mirror_rot90: [0, -1, -1, 0],
    mirror_rot180: [1, 0, 0, -1],
    mirror_rot270: [0, 1, 1, 0],
  } as const;
  for (const transform of Object.keys(transforms) as SceneTransform[]) {
    const { svg, engine, layers } = mount({ labelOffset }, 2, transform);
    const [a, b, c, d] = transforms[transform];
    const projectOffset = (x: number, y: number) => ({
      x: a * (x - labelAt.x) + c * (y - labelAt.y),
      y: b * (x - labelAt.x) + d * (y - labelAt.y),
    });
    const label = layers.find(({ id }) => id === 'components.labels')!;
    const hit = label.hits!(engine.snapshot(), 2, transform)[0]!;
    expect(hit.shape.type).toBe('area');
    if (hit.shape.type !== 'area') throw new Error('Expected label polygon');
    const expected = [
      [-24.04, -11],
      [24.04, -11],
      [24.04, 30.2],
      [-24.04, 30.2],
    ];
    hit.shape.polygon.forEach(({ x, y }, index) => {
      const screen = projectOffset(x, y);
      expect(screen.x, transform).toBeCloseTo(expected[index]![0]!);
      expect(screen.y, transform).toBeCloseTo(expected[index]![1]!);
    });
    const texts = svg.querySelectorAll('[data-layer="components.labels"] text');
    const value = [...texts].find((text) => text.textContent === '100R')!;
    const valueOffset = projectOffset(
      Number(value.getAttribute('x')),
      Number(value.getAttribute('y')),
    );
    expect(valueOffset.x, transform).toBeCloseTo(0);
    expect(valueOffset.y, transform).toBeCloseTo(19.2);
    act(() =>
      useSessionStore.getState().setPreview({
        owner: 'components.label',
        data: { id, dx: 7, dy: -4 },
      }),
    );
    expect(value.closest('[transform="translate(7 -4)"]')).toBeTruthy();
    cleanup();
    useSessionStore.getState().reset('');
  }
});
