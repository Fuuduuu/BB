// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import * as ui from '@pcbk/ui';
import type { SceneTransform } from '@pcbk/ui';
import type { BoardDoc } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import { expect, test, vi } from 'vitest';
import { mountMeasurements, pinRef, pointer } from '../__tests__/workspace';
import * as placement from './layers/reading-placement';

function seed(doc: BoardDoc) {
  doc.measurements.push(
    {
      id: 'msr_voltage',
      mode: 'voltage',
      at: pinRef('1'),
      atLabel: 'U1.1',
      value: 4.98,
      power: 'on',
      takenAt: '2026-11-10T10:00:00Z',
      source: 'manual',
    },
    {
      id: 'msr_resistance',
      mode: 'resistance',
      at: pinRef('2'),
      atLabel: 'U1.2',
      value: 2000,
      power: 'off',
      takenAt: '2026-11-10T10:01:00Z',
      source: 'manual',
    },
  );
}

test('reading_label_shown_on_pin', () => {
  const { svg, pinPoint } = mountMeasurements({ seed });
  const pin = pinPoint('1');
  const layer = svg.querySelector('[data-layer="measurements.readings"]')!;
  const ring = layer.querySelector('circle')!;
  expect(layer.querySelectorAll('circle')).toHaveLength(1);
  expect(Number(ring.getAttribute('cx'))).toBeCloseTo(pin.x);
  expect(Number(ring.getAttribute('cy'))).toBeCloseTo(pin.y);
  expect(ring.getAttribute('stroke')).toBe('var(--ink-2)');
  expect(ring.getAttribute('stroke-width')).toBe('2.5');
  expect(ring.getAttribute('vector-effect')).toBe('non-scaling-stroke');
  const label = screen.getByText('4,98 V');
  expect(layer.querySelector('text')).toBe(label);
  expect(label.getAttribute('font-family')).toBe('var(--f-mono)');
});

test('reading_label_insets_glyph_inside_halo_box', () => {
  mountMeasurements({ seed });
  const label = screen.getByText('4,98 V');
  const dx = Number(label.getAttribute('dx'));
  const dy = Number(label.getAttribute('dy'));
  // The candidate starts at the padded box edge: move its text anchor 2px inside at zoom 1.
  expect(Math.abs(dx) - Math.abs(dy)).toBeCloseTo(2);
});

test('scale_preview_hides_only_the_scaled_components_readings', () => {
  const placeLabel = vi.spyOn(placement, 'placeReadingLabel');
  try {
    const { engine, pinPoint, svg } = mountMeasurements({
      seed(doc) {
        seed(doc);
        const original = doc.components[0]!;
        const other = {
          ...original,
          id: 'cmp_u2',
          ref: 'U2',
          pins: original.pins.map((pin) => ({ ...pin, uid: `pin_u2_${pin.id}` })),
          board: { ...original.board!, center: { x: 410, y: 100 } },
        };
        doc.components.push(other);
        doc.measurements.push({
          ...doc.measurements[0]!,
          id: 'msr_u2_voltage',
          at: { c: other.id, p: '1', uid: other.pins[0]!.uid },
          atLabel: 'U2.1',
          value: 3.3,
        });
      },
    });
    const id = pinRef('1').c;
    const stationary = screen.getByText('3,3 V');
    const placementCalls = placeLabel.mock.calls.length;
    act(() =>
      ui.useSessionStore.getState().setPreview({
        owner: 'components.scale',
        data: { id: `${id}:e`, dx: 10, dy: 0 },
      }),
    );
    expect(screen.queryByText('4,98 V')).toBeNull();
    expect(screen.getByText('3,3 V')).toBe(stationary);
    expect(placeLabel).toHaveBeenCalledTimes(placementCalls);

    act(() => {
      ui.useSessionStore.getState().setPreview(null);
      expect(engine.execute('components.setScale', { id, scaleX: 1.5, scaleY: 1 }).ok).toBe(true);
    });
    const reading = screen.getByText('4,98 V');
    const ring = reading.closest('g')?.querySelector('circle');
    expect(svg.contains(reading)).toBe(true);
    expect(Number(ring?.getAttribute('cx'))).toBeCloseTo(pinPoint('1').x);
  } finally {
    placeLabel.mockRestore();
  }
});

test('reading_label_points_away_from_component_body', () => {
  const { engine } = mountMeasurements({
    seed(doc) {
      seed(doc);
      const component = doc.components[0]!;
      component.board = { ...component.board!, footprint: 'soic', params: { pins: 8, body: 3.9 } };
      component.pins.push(
        ...['5', '6', '7', '8'].map((id) => ({ id, uid: pinRef(id).uid, nc: false })),
      );
      doc.measurements.push({
        ...doc.measurements[0]!,
        id: 'msr_other_voltage',
        at: pinRef('5'),
        atLabel: 'U1.5',
        value: 3.3,
      });
    },
  });

  const expectDirection = (reading: string, anchor: 'start' | 'end') => {
    const label = screen.getByText(reading);
    expect(label.getAttribute('text-anchor')).toBe(anchor);
    const dy = Number(label.getAttribute('dy'));
    expect(dy).toBeLessThan(0);
    expect(Number(label.getAttribute('dx'))).toBe(anchor === 'end' ? dy - 2 : -dy + 2);
  };

  expectDirection('4,98 V', 'end');
  expectDirection('3,3 V', 'start');

  act(() => {
    expect(engine.execute('components.rotate', { ids: [pinRef('1').c], deltaDeg: 90 }).ok).toBe(
      true,
    );
  });

  expectDirection('4,98 V', 'start');
  expectDirection('3,3 V', 'end');
});

test('reading_label_follows_drag_preview', () => {
  const { engine, host, svg, pinPoint } = mountMeasurements({ seed: seedLabelCollision });
  const before = engine.snapshot();
  const pin = pinPoint('1');
  const layer = svg.querySelector('[data-layer="measurements.readings"]')!;
  const coordinates = () => {
    const ring = layer.querySelector('circle')!;
    const label = layer.querySelector('text')!;
    return {
      ringX: Number(ring.getAttribute('cx')),
      ringY: Number(ring.getAttribute('cy')),
      labelX: Number(label.getAttribute('x')),
      labelY: Number(label.getAttribute('y')),
      labelDx: Number(label.getAttribute('dx')),
      labelDy: Number(label.getAttribute('dy')),
      labelAnchor: label.getAttribute('text-anchor'),
    };
  };
  const original = coordinates();
  const dx = 50;
  const dy = -11;
  pointer(svg, 'pointerdown', pin.x, pin.y);
  pointer(svg, 'pointermove', pin.x + dx, pin.y + dy);

  const moved = coordinates();
  expect(moved.ringX).toBeCloseTo(original.ringX + dx);
  expect(moved.ringY).toBeCloseTo(original.ringY + dy);
  expect(moved.labelX).toBeCloseTo(original.labelX + dx);
  expect(moved.labelY).toBeCloseTo(original.labelY + dy);
  expect(moved.labelDx).toBe(original.labelDx);
  expect(moved.labelDy).toBe(original.labelDy);
  expect(moved.labelAnchor).toBe(original.labelAnchor);
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);

  fireEvent.keyDown(svg, { key: 'Escape' });
  expect(coordinates()).toEqual(original);
});

test('drag_preview_rerenders_only_dragged_readings', () => {
  const renderText = vi.spyOn(ui, 'SceneText');
  const placeLabel = vi.spyOn(placement, 'placeReadingLabel');
  try {
    const { svg, pinPoint } = mountMeasurements({
      seed(doc) {
        seed(doc);
        const original = doc.components[0]!;
        const other = {
          ...original,
          id: 'cmp_u2',
          ref: 'U2',
          pins: original.pins.map((pin) => ({ ...pin, uid: `pin_u2_${pin.id}` })),
          board: { ...original.board!, center: { x: 410, y: 100 } },
        };
        doc.components.push(other);
        doc.measurements.push({
          ...doc.measurements[0]!,
          id: 'msr_stationary_voltage',
          at: { c: other.id, p: '1', uid: other.pins[0]!.uid },
          atLabel: 'U2.1',
          value: 3.3,
        });
      },
    });
    expect(screen.getByText('4,98 V')).toBeTruthy();
    expect(screen.getByText('3,3 V')).toBeTruthy();
    expect(placeLabel).toHaveBeenCalled();
    const pin = pinPoint('1');
    pointer(svg, 'pointerdown', pin.x, pin.y);
    const initialPlacementCalls = placeLabel.mock.calls.length;
    renderText.mockClear();

    for (let frame = 1; frame <= 10; frame++) {
      pointer(svg, 'pointermove', pin.x + frame * 10, pin.y - frame);
    }

    expect(placeLabel).toHaveBeenCalledTimes(initialPlacementCalls);
    const rendered = renderText.mock.calls.map(([props]) => props.children);
    expect(rendered.filter((text) => text === '4,98 V')).toHaveLength(10);
    expect(rendered.filter((text) => text === '3,3 V')).toHaveLength(0);
  } finally {
    renderText.mockRestore();
    placeLabel.mockRestore();
  }
});

test('reading_label_side_follows_screen_under_all_8_transforms', () => {
  const cases = {
    none: 'end',
    rot90: 'start',
    rot180: 'start',
    rot270: 'end',
    mirror: 'start',
    mirror_rot90: 'start',
    mirror_rot180: 'end',
    mirror_rot270: 'end',
  } as const;
  for (const transform of Object.keys(cases) as SceneTransform[]) {
    mountMeasurements({
      sceneTransform: transform,
      seed(doc) {
        seed(doc);
        const component = doc.components[0]!;
        component.board = {
          ...component.board!,
          footprint: 'soic',
          params: { pins: 8, body: 3.9 },
        };
        component.pins.push(
          ...['5', '6', '7', '8'].map((id) => ({ id, uid: pinRef(id).uid, nc: false })),
        );
      },
    });
    const label = screen.getByText('4,98 V');
    expect(label.getAttribute('text-anchor'), transform).toBe(cases[transform]);
    expect(Number(label.getAttribute('dy'))).toBeLessThan(0);
    expect(Number(label.getAttribute('dx'))).toBe(
      cases[transform] === 'end'
        ? Number(label.getAttribute('dy')) - 2
        : -Number(label.getAttribute('dy')) + 2,
    );
    cleanup();
  }
});

function textBounds(text: Element) {
  const size = Number(text.getAttribute('font-size'));
  // Chromium's measured 59.4px advance for seven characters at 12px, independent of the estimator.
  const width = Array.from(text.textContent ?? '').length * (59.4 / 7 / 12) * size;
  const x = Number(text.getAttribute('x')) + Number(text.getAttribute('dx'));
  const y = Number(text.getAttribute('y')) + Number(text.getAttribute('dy'));
  const anchor = text.getAttribute('text-anchor');
  const left = x - (anchor === 'end' ? width : anchor === 'middle' ? width / 2 : 0);
  return { left, right: left + width, top: y - (1.25 * size) / 2, bottom: y + (1.25 * size) / 2 };
}

function boundsOverlap(a: ReturnType<typeof textBounds>, b: ReturnType<typeof textBounds>) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function seedLabelCollision(doc: BoardDoc) {
  seed(doc);
  const component = doc.components[0]!;
  const board = component.board!;
  const pin = boardPads(board, ['1'], doc.scale.pxPerMm)[0]!;
  // Pin 1 is on the left; place the component reference across its first label candidate.
  board.labelOffset = { x: pin.at.x - board.center.x - 35, y: -12 };
}

test('reading_label_avoids_own_ref_label', () => {
  mountMeasurements({ seed: seedLabelCollision });
  const reference = screen.getByText('U1', { selector: 'text' });
  const reading = screen.getByText('4,98 V');
  expect(boundsOverlap(textBounds(reference), textBounds(reading))).toBe(false);
});

test('reading_label_avoids_other_reading_labels', () => {
  mountMeasurements({
    seed(doc) {
      seed(doc);
      const component = doc.components[0]!;
      component.board!.footprint = 'custom-test';
      component.board!.customPads = Object.fromEntries(
        ['1', '2'].map((id) => [
          id,
          {
            local: { x: -2, y: 0 },
            sizeMm: 1,
            shape: 'circle',
            through: true,
          },
        ]),
      );
      doc.measurements[1] = {
        ...doc.measurements[0]!,
        id: 'msr_second_voltage',
        at: pinRef('2'),
        atLabel: 'U1.2',
        value: 3.3,
      };
    },
  });
  expect(
    boundsOverlap(textBounds(screen.getByText('4,98 V')), textBounds(screen.getByText('3,3 V'))),
  ).toBe(false);
});

test('reading_label_draws_leader_line_when_moved', () => {
  const { svg } = mountMeasurements({
    seed(doc) {
      seed(doc);
      const component = doc.components[0]!;
      const board = component.board!;
      const pin = boardPads(board, ['1'], doc.scale.pxPerMm)[0]!;
      component.ref = 'VERY_LONG_REFERENCE';
      board.labelOffset = { x: pin.at.x - board.center.x, y: 0 };
      component.value = 'long value';
    },
  });
  const leader = svg.querySelector('[data-layer="measurements.readings"] line');
  expect(leader).not.toBeNull();
  expect(leader!.getAttribute('stroke')).toBe('var(--ink-2)');
  expect(leader!.getAttribute('stroke-width')).toBe('1');
  expect(leader!.getAttribute('vector-effect')).toBe('non-scaling-stroke');
});

test('reading_labels_use_measured_font_bounds_for_adjacent_pads', () => {
  mountMeasurements({
    seed(doc) {
      seed(doc);
      const component = doc.components[0]!;
      component.board = {
        ...component.board!,
        footprint: 'area',
        center: { x: 150, y: 150 },
        labelOffset: { x: -80, y: -80 },
        customPads: Object.fromEntries(
          ['1', '2'].map((id, index) => [
            id,
            {
              local: { x: index === 0 ? 2 : 7.4, y: 0 },
              sizeMm: 1,
              shape: 'circle',
              through: true,
            },
          ]),
        ),
      };
      doc.measurements[0]!.value = 3.651;
      doc.measurements[1] = {
        ...doc.measurements[0]!,
        id: 'msr_adjacent',
        at: pinRef('2'),
        atLabel: 'U1.2',
        value: 3.652,
      };
    },
  });
  const first = textBounds(screen.getByText('3,651 V'));
  const second = textBounds(screen.getByText('3,652 V'));
  expect(boundsOverlap(first, second)).toBe(false);
});
