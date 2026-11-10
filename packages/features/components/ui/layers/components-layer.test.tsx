// @vitest-environment jsdom
import { Fragment } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { DocumentEngine } from '@pcbk/contracts';
import { newBoardDoc } from '@pcbk/domain';
import * as geometry from '@pcbk/domain/geometry';
import { Canvas, useSessionStore } from '@pcbk/ui';
import type { Preview } from '@pcbk/ui';
import { idGenerator, setup } from '../../../__tests__/helpers';
import type { AddComponentParams } from '../../contract';
import { createComponentsUi } from '../index';

const layers = createComponentsUi(idGenerator()).canvasLayers ?? [];
const chip = { footprint: 'chip', center: { x: 100, y: 80 } };

function add(engine: DocumentEngine, overrides: Partial<AddComponentParams> = {}) {
  const id = overrides.id ?? 'cmp_a';
  expect(
    engine.execute('components.add', {
      id,
      kind: 'resistor',
      pins: [
        { id: '1', uid: `pin_${id}_1` },
        { id: '2', uid: `pin_${id}_2` },
      ],
      board: chip,
      ...overrides,
    }).ok,
  ).toBe(true);
}

function circularPadsBoard() {
  const doc = newBoardDoc('Plaat');
  doc.components.push({
    id: 'cmp_a',
    ref: 'J1',
    kind: 'connector',
    identified: true,
    dnp: false,
    marking: '',
    value: '',
    note: '',
    pins: [
      { id: 'GND', uid: 'pin_a', nc: false, name: 'Ground' },
      { id: '2', uid: 'pin_b', nc: false },
    ],
    board: {
      ...chip,
      footprint: 'area',
      params: {},
      side: 'top',
      rotationDeg: 0,
      scaleX: 1,
      scaleY: 1,
      customPads: {
        GND: { local: { x: -2, y: 0 }, sizeMm: 2, shape: 'circle', through: true },
        '2': { local: { x: 2, y: 0 }, sizeMm: 2, shape: 'circle', through: true },
      },
    },
  });
  return setup(doc).engine;
}

function mount(engine: DocumentEngine, zoom = 1) {
  function scene(nextZoom: number, preview: Preview | null) {
    const snapshot = engine.snapshot();
    return (
      <svg>
        {layers.map((layer) => (
          <Fragment key={layer.id}>{layer.render({ snapshot, zoom: nextZoom, preview })}</Fragment>
        ))}
      </svg>
    );
  }
  const result = render(scene(zoom, null));
  return {
    update: (nextZoom = zoom, preview: Preview | null = null) =>
      result.rerender(scene(nextZoom, preview)),
    group: (layer: string, id = 'cmp_a') =>
      result.container.querySelector(`[data-layer="components.${layer}"] [data-component="${id}"]`),
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useSessionStore.getState().reset('');
});

test('pin1_is_square', () => {
  const pins = mount(circularPadsBoard()).group('pins');
  expect(pins?.querySelector('[data-pin="GND"] rect')).toBeTruthy();
  expect(pins?.querySelector('[data-pin="GND"] circle')).toBeNull();
  expect(pins?.querySelector('[data-pin="2"] circle')).toBeTruthy();
});

test('pin_number_hidden_below_7px_radius_and_name_below_14px', () => {
  const { update } = mount(circularPadsBoard(), 0.69);
  expect(screen.queryByText('GND')).toBeNull();
  expect(screen.queryByText('Ground')).toBeNull();

  update(0.7);
  expect(screen.getByText('GND')).toBeTruthy();
  update(1.39);
  expect(screen.queryByText('Ground')).toBeNull();

  update(1.4);
  expect(screen.getByText('GND')).toBeTruthy();
  expect(screen.getByText('Ground')).toBeTruthy();
});

test('pad_min_diameter_10px_at_low_zoom', () => {
  const { engine } = setup();
  add(engine);
  const zoom = 0.25;
  const pins = mount(engine, zoom).group('pins');
  const square = pins?.querySelector('[data-pin="1"] rect');
  const circle = pins?.querySelector('[data-pin="2"] circle');
  expect(square?.getAttribute('width')).toBe('40');
  expect(square?.getAttribute('height')).toBe('40');
  expect(circle?.getAttribute('r')).toBe('20');
});

test('bottom_side_component_is_dashed_and_mirrored', () => {
  const doc = newBoardDoc('Plaat');
  doc.scale.pxPerMm = 12;
  const { engine } = setup(doc);
  add(engine, { board: { ...chip, side: 'bottom' } });
  const { group, update } = mount(engine);
  const body = group('bodies')?.querySelector('[stroke="var(--body)"]');
  const pin1 = group('pins')?.querySelector('[data-pin="1"] rect');
  expect(body?.getAttribute('points')).toBe('112,72.5 88,72.5 88,87.5 112,87.5');
  expect(body?.getAttribute('vector-effect')).toBe('non-scaling-stroke');
  const dashes = body?.getAttribute('stroke-dasharray');
  expect(dashes).toBeTruthy();
  update(2);
  expect(body?.getAttribute('stroke-dasharray')).toBe(dashes);
  const centerX = Number(pin1?.getAttribute('x')) + Number(pin1?.getAttribute('width')) / 2;
  expect(centerX).toBeCloseTo(112);
});

test('unplaced_component_not_drawn', () => {
  const { engine } = setup();
  add(engine);
  add(engine, { id: 'cmp_b', ref: 'R2', board: undefined });
  const { group } = mount(engine);
  expect(layers.map(({ id, z }) => [id, z])).toEqual([
    ['components.bodies', 30],
    ['components.pins', 50],
    ['components.labels', 60],
  ]);
  for (const layer of ['bodies', 'pins', 'labels']) {
    expect(group(layer)).toBeTruthy();
    expect(group(layer, 'cmp_b')).toBeNull();
  }
  expect(screen.queryByText('R2')).toBeNull();
});

test('component_rerenders_only_on_own_change', () => {
  const { engine } = setup();
  add(engine, { ref: 'R1' });
  add(engine, { id: 'cmp_b', ref: 'R2', board: { ...chip, center: { x: 200, y: 80 } } });
  const renderPads = vi.spyOn(geometry, 'boardPads');
  const { update } = mount(engine);
  expect(renderPads).toHaveBeenCalled();
  renderPads.mockClear();

  expect(engine.execute('components.update', { id: 'cmp_b', ref: 'R20' }).ok).toBe(true);
  update();
  expect(screen.getByText('R20')).toBeTruthy();
  expect(renderPads.mock.calls.map(([board]) => board.center.x)).toEqual([200, 200]);
  renderPads.mockClear();

  expect(engine.execute('project.rename', { name: 'Uus nimi' }).ok).toBe(true);
  update();
  expect(renderPads).not.toHaveBeenCalled();

  expect(engine.execute('components.update', { id: 'cmp_a', ref: 'R10' }).ok).toBe(true);
  update();
  expect(screen.getByText('R10')).toBeTruthy();
  expect(renderPads.mock.calls.map(([board]) => board.center.x)).toEqual([100, 100]);
});

test('nc_pin_shows_cross', () => {
  const { engine } = setup();
  add(engine);
  expect(engine.execute('components.setNc', { id: 'cmp_a', pinId: '1', nc: true }).ok).toBe(true);
  const pins = mount(engine).group('pins');
  const nc = pins?.querySelector('[data-pin="1"]');
  const ordinary = pins?.querySelector('[data-pin="2"]');
  expect(nc?.querySelector('path')).toBeTruthy();
  expect(nc?.querySelector('[stroke="var(--ink-3)"]')?.getAttribute('stroke-width')).toBe('1');
  expect(ordinary?.querySelector('path')).toBeNull();
  expect(ordinary?.querySelector('[stroke="var(--ink-3)"]')?.getAttribute('stroke-width')).toBe(
    '1.5',
  );
});

test('dnp_and_unidentified_component_markers', () => {
  const { engine } = setup();
  add(engine, { ref: 'R1', value: '10 kΩ' });
  expect(
    engine.execute('components.update', { id: 'cmp_a', dnp: true, identified: false }).ok,
  ).toBe(true);
  const { group } = mount(engine);
  expect(group('bodies')?.getAttribute('opacity')).toBe('0.4');
  const ref = screen.getByText('R1');
  expect(ref.getAttribute('text-decoration')).toBe('line-through');
  const marker = screen.getByText('?');
  expect(marker.closest('text')).toBe(ref.closest('text'));
  expect(Number(marker.getAttribute('font-size'))).toBeLessThan(16);
  expect(screen.getByText('10 kΩ').getAttribute('text-decoration')).toBeNull();
});

test('drag_preview_moves_only_dragged_components', () => {
  const { engine } = setup();
  add(engine);
  add(engine, { id: 'cmp_b' });
  const { group, update } = mount(engine);
  const before = engine.snapshot();
  update(1, {
    owner: 'select',
    data: { items: [{ kind: 'component', id: 'cmp_a' }], dx: 4, dy: -3 },
  });
  for (const layer of ['bodies', 'pins', 'labels']) {
    expect(group(layer)?.getAttribute('transform')).toBe('translate(4 -3)');
    expect(group(layer, 'cmp_b')?.getAttribute('transform')).toBeNull();
  }
  update(1, { owner: 'components.label', data: { id: 'cmp_a', dx: 4, dy: -3 } });
  expect(group('bodies')?.getAttribute('transform')).toBeNull();
  expect(group('pins')?.getAttribute('transform')).toBeNull();
  const label = screen.getByText('R1');
  expect(label.closest('[transform="translate(4 -3)"]')).toBeTruthy();
  expect(screen.getByText('R2').closest('[transform="translate(4 -3)"]')).toBeNull();
  expect(engine.snapshot()).toBe(before);
});

test('component_labels_use_scene_text', () => {
  const { engine } = setup();
  add(engine, { ref: 'R1', value: '10 kΩ' });
  expect(
    engine.execute('components.setLabelOffset', { id: 'cmp_a', offset: { x: 3, y: -20 } }).ok,
  ).toBe(true);
  render(
    <Canvas
      layers={layers}
      tools={[]}
      snapshot={engine.snapshot()}
      execute={engine.execute}
      sceneTransform="mirror"
      view={{ zoom: 2, pan: { x: 0, y: 0 } }}
      onViewChange={() => {}}
    />,
  );
  const ref = screen.getByText('R1');
  const value = screen.getByText('10 kΩ');
  expect(ref.getAttribute('transform')).toBe('matrix(-1 0 0 1 206 0)');
  expect(value.getAttribute('transform')).toBe('matrix(-1 0 0 1 206 0)');
  expect(ref.getAttribute('y')).toBe('60');
  expect(Number(value.getAttribute('y'))).toBeCloseTo(79.2);
  expect(ref.getAttribute('font-size')).toBe('16');
  expect(ref.getAttribute('font-family')).toBe('var(--f-mono)');
  expect(ref.style.fontVariantNumeric).toBe('tabular-nums');
});

test('selection_highlights_only_the_selected_pin_or_body', () => {
  const { engine } = setup();
  add(engine);
  const { group } = mount(engine);
  const select = (kind: string, id: string, componentId?: string) =>
    act(() => useSessionStore.getState().setSelection({ items: [{ kind, id, componentId }] }));

  select('pin', '2', 'cmp_a');
  expect(group('pins')?.querySelector('[data-pin="2"] [stroke="var(--sel)"]')).toBeTruthy();
  expect(group('pins')?.querySelector('[data-pin="1"] [stroke="var(--sel)"]')).toBeNull();
  expect(group('bodies')?.querySelector('[stroke="var(--sel)"]')).toBeNull();

  select('component', 'cmp_a');
  expect(group('pins')?.querySelector('[stroke="var(--sel)"]')).toBeNull();
  expect(group('bodies')?.querySelector('[stroke="var(--sel)"]')).toBeTruthy();
});
