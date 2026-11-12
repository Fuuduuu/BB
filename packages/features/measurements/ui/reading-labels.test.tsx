// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { SceneTransform } from '@pcbk/ui';
import type { BoardDoc } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { mountMeasurements, pinRef, pointer } from '../__tests__/workspace';

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
    expect(Number(label.getAttribute('dx'))).toBe(anchor === 'end' ? dy : -dy);
  };

  expectDirection('4,98 V', 'end');
  expectDirection('3,3 V', 'start');

  act(() => {
    expect(engine.execute('components.rotate', { id: pinRef('1').c, deltaDeg: 90 }).ok).toBe(true);
  });

  expectDirection('4,98 V', 'start');
  expectDirection('3,3 V', 'end');
});

test('reading_label_follows_drag_preview', () => {
  const { engine, host, svg, pinPoint } = mountMeasurements({ seed });
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
        ? Number(label.getAttribute('dy'))
        : -Number(label.getAttribute('dy')),
    );
    cleanup();
  }
});
