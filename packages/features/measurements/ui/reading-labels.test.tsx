// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
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
    };
  };
  const original = coordinates();
  const dx = 23;
  const dy = -11;
  pointer(svg, 'pointerdown', pin.x, pin.y);
  pointer(svg, 'pointermove', pin.x + dx, pin.y + dy);

  const moved = coordinates();
  expect(moved.ringX).toBeCloseTo(original.ringX + dx);
  expect(moved.ringY).toBeCloseTo(original.ringY + dy);
  expect(moved.labelX).toBeCloseTo(original.labelX + dx);
  expect(moved.labelY).toBeCloseTo(original.labelY + dy);
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);

  fireEvent.keyDown(svg, { key: 'Escape' });
  expect(coordinates()).toEqual(original);
});
