// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import { useSessionStore, useViewStore } from '@pcbk/ui';
import { expect, test } from 'vitest';
import { mountMeasurements, pointer } from '../../measurements/__tests__/workspace';

const end = (p: string) => ({ pin: { c: 'cmp_u1', p } });
const pin = (id: string) => ({ kind: 'pin', componentId: 'cmp_u1', id });

test('quick_connect_creates_assumed_air_lines_in_one_step', () => {
  const existing = { id: 'con_existing', a: end('1'), b: end('2'), basis: 'visual' } as const;
  const { engine, host, svg, pinPoint } = mountMeasurements({
    seed(doc) {
      doc.connections.push({
        ...existing,
        board: { kind: 'trace', layer: 'top', waypoints: [], widthMm: 0.2 },
      });
    },
  });
  const original = engine.snapshot().doc.connections;
  const selection = { items: ['1', '2', '3'].map(pin) };
  act(() => useSessionStore.getState().setSelection(selection));
  fireEvent.keyDown(svg, { key: 'c' });

  const connections = engine.snapshot().doc.connections;
  expect(connections).toEqual([
    ...original,
    { id: expect.stringMatching(/^con_/), a: end('2'), b: end('3'), basis: 'assumed' },
  ]);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['connections.add']);
  expect(useSessionStore.getState().selection).toEqual(selection);

  const line = () => svg.querySelector('[data-layer="connections.airLines"] line');
  expect(line()?.getAttribute('stroke-width')).toBe('1.5');
  expect(line()?.getAttribute('stroke-dasharray')).toBe('6 4');
  expect(line()?.getAttribute('vector-effect')).toBe('non-scaling-stroke');
  const a = pinPoint('2');
  const b = pinPoint('3');
  const clickLine = (offset = 0) => {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const x = (a.x + b.x) / 2 - ((b.y - a.y) / length) * offset;
    const y = (a.y + b.y) / 2 + ((b.x - a.x) / length) * offset;
    pointer(svg, 'pointerdown', x, y);
    pointer(svg, 'pointerup', x, y);
  };
  clickLine();
  const selectedLine = { kind: 'connection', id: connections[1]!.id };
  expect(useSessionStore.getState().selection.items).toEqual([selectedLine]);
  clickLine(4);
  expect(useSessionStore.getState().selection.items).not.toContainEqual(selectedLine);

  const toggle = screen.getByRole('button', { name: 'Õhujooned' });
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
  expect(useViewStore.getState().modules.connections).toEqual({ airLines: false });
  expect(line()).toBeNull();
  clickLine();
  expect(useSessionStore.getState().selection.items).not.toContainEqual(selectedLine);

  fireEvent.click(toggle);
  expect(useViewStore.getState().modules.connections).toEqual({ airLines: true });
  clickLine(2);
  expect(useSessionStore.getState().selection.items).toEqual([selectedLine]);

  fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
  expect(engine.snapshot().doc.connections).toEqual(original);
  host.drainJournal();
  act(() => useSessionStore.getState().setSelection({ items: [pin('1')] }));
  fireEvent.keyDown(svg, { key: 'c' });
  expect(host.drainJournal()).toEqual([]);
});
