// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { mountMeasurements, pinRef, pointer, seedRemovablePins } from '../__tests__/workspace';

const connectName = /^Piiksub ja ühenda/u;
type Engine = ReturnType<typeof mountMeasurements>['engine'];

function counts(engine: Engine) {
  const { measurements, connections } = engine.snapshot().doc;
  return [measurements.length, connections.length] as const;
}

function click(svg: SVGSVGElement, x: number, y: number) {
  pointer(svg, 'pointerdown', x, y);
  pointer(svg, 'pointerup', x, y);
}

function pressButtonEnter(button: HTMLElement) {
  button.focus();
  expect(document.activeElement).toBe(button);
  // jsdom does not dispatch a button click as the default action of Enter.
  if (fireEvent.keyDown(button, { key: 'Enter' })) fireEvent.click(button);
  fireEvent.keyUp(button, { key: 'Enter' });
}

test('beep_enter_ignored_when_focus_is_elsewhere', () => {
  const { engine, svg, clickPin } = mountMeasurements({
    seed(doc) {
      const part = doc.components[0]!;
      const board = part.board!;
      doc.components.push(
        {
          ...part,
          id: 'cmp_u2',
          ref: 'U2',
          pins: [{ id: '1', uid: 'pin_u2_1', nc: false }],
          board: { ...board, center: { x: 300, y: 100 }, params: { pins: 1, pitch: 2.54 } },
        },
        {
          ...part,
          id: 'cmp_r1',
          ref: 'R1',
          kind: 'resistor',
          pins: [
            { id: '1', uid: 'pin_r1_1', nc: false },
            { id: '2', uid: 'pin_r1_2', nc: false },
          ],
          board: { ...board, center: { x: 400, y: 100 }, params: { pins: 2, pitch: 2.54 } },
        },
      );
    },
  });
  act(() => {
    expect(engine.execute('components.update', { id: 'cmp_u1', note: 'Ajutine märge' }).ok).toBe(
      true,
    );
  });

  fireEvent.keyDown(svg, { key: 'b' });
  clickPin('1');
  click(svg, 300, 100);
  expect(screen.getByRole('button', { name: connectName })).toBeTruthy();
  pressButtonEnter(screen.getByRole('button', { name: 'Võta tagasi' }));
  expect.soft(counts(engine)).toEqual([0, 0]);
  expect.soft(engine.snapshot().doc.components[0]?.note).toBe('');

  fireEvent.keyDown(svg, { key: 'Escape' });
  fireEvent.keyDown(svg, { key: 'Escape' });
  fireEvent.keyDown(svg, { key: 'b' });
  click(svg, 387.3, 100);
  click(svg, 412.7, 100);
  const [measurements, connections] = counts(engine);
  svg.focus();
  expect(document.activeElement).toBe(svg);
  fireEvent.keyDown(svg, { key: 'Enter' });
  expect(
    screen.getByRole('dialog', { name: 'Piiksub läbi komponendi R1. Ühendan ikkagi?' }),
  ).toBeTruthy();
  expect(counts(engine)).toEqual([measurements + 1, connections]);

  pressButtonEnter(screen.getByRole('button', { name: 'Lisa foto' }));
  expect.soft(counts(engine)).toEqual([measurements + 1, connections]);

  svg.focus();
  fireEvent.keyDown(svg, { key: 'Enter' });
  expect.soft(counts(engine)).toEqual([measurements + 1, connections + 1]);
});

test('beep_click_prefers_visible_pad', () => {
  const { engine, svg, clickPin } = mountMeasurements({
    seed(doc) {
      seedRemovablePins(doc);
      const pads = doc.components[0]!.board!.customPads;
      pads['1'] = { ...pads['1']!, local: { x: -4, y: 0 }, sizeMm: 2 };
      pads['2'] = { ...pads['2']!, local: { x: -2.5, y: 0 }, sizeMm: 0.5 };
    },
  });

  fireEvent.keyDown(svg, { key: 'b' });
  clickPin('4');
  click(svg, 129.5, 100);
  fireEvent.keyDown(svg, { key: 'Enter' });
  expect(counts(engine)).toEqual([1, 1]);
  const first = engine.snapshot().doc;
  expect.soft(first.measurements[0]).toMatchObject({
    at: pinRef('1'),
    ref: pinRef('4'),
    beep: true,
  });
  expect.soft(first.connections[0]).toMatchObject({
    a: { pin: { c: 'cmp_u1', p: '4' } },
    b: { pin: { c: 'cmp_u1', p: '1' } },
  });

  click(svg, 130.5, 100);
  fireEvent.keyDown(svg, { key: 'Enter' });
  expect.soft(counts(engine)).toEqual([2, 2]);
  const second = engine.snapshot().doc;
  expect.soft(second.measurements[1]).toMatchObject({
    at: pinRef('2'),
    ref: pinRef('4'),
    beep: true,
  });
  expect.soft(second.connections[1]).toMatchObject({
    a: { pin: { c: 'cmp_u1', p: '4' } },
    b: { pin: { c: 'cmp_u1', p: '2' } },
  });
});

test('beep_probe_shows_at_clicked_pad', () => {
  const { engine, container } = mountMeasurements({
    seed(doc) {
      doc.components[0]!.board!.padMap = { '4': '1' };
    },
  });
  const scene = container.querySelector('[data-scene]')!;
  const svg = scene.closest('svg')!;
  const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  Object.defineProperty(scene, 'getScreenCTM', {
    value: () => ({ ...matrix, inverse: () => matrix }),
  });
  Object.defineProperties(svg, {
    setPointerCapture: { value: () => {} },
    hasPointerCapture: { value: () => false },
  });
  Object.defineProperty(svg.parentElement!, 'getBoundingClientRect', {
    value: () => new DOMRect(0, 0, 800, 600),
  });

  fireEvent.keyDown(svg, { key: 'b' });
  click(svg, 147.3, 100);
  click(svg, 198.1, 100);
  const ring = svg.querySelector('circle[stroke="var(--danger)"]');
  const hud = screen
    .getByRole('button', { name: connectName })
    .closest<HTMLElement>('[data-canvas-hud]');
  expect.soft(Number(ring?.getAttribute('cx'))).toBeCloseTo(198.1);
  expect.soft(Number(ring?.getAttribute('cy'))).toBeCloseTo(100);
  expect.soft(Number.parseFloat(hud?.style.left ?? '')).toBeCloseTo(206.1);
  expect.soft(Number.parseFloat(hud?.style.top ?? '')).toBeCloseTo(108);

  fireEvent.keyDown(svg, { key: 'Enter' });
  expect(counts(engine)).toEqual([1, 1]);
  expect(engine.snapshot().doc.measurements[0]).toMatchObject({
    at: pinRef('1'),
    ref: pinRef('2'),
    beep: true,
  });
});

test('beep_oval_corner_records_neighbour_pin', () => {
  const neighbour = { c: 'cmp_p1', p: '1', uid: 'pin_p1_1' };
  const oval = { c: 'cmp_q1', p: '3', uid: 'pin_q1_3' };
  const { engine, svg, clickPin } = mountMeasurements({
    seed(doc) {
      doc.scale.pxPerMm = 20;
      const source = doc.components[0]!;
      const board = source.board!;
      doc.components.push(
        {
          ...source,
          id: oval.c,
          ref: 'Q1',
          kind: 'npn',
          pins: ['1', '2', '3'].map((id) => ({ id, uid: `pin_q1_${id}`, nc: false })),
          board: { ...board, footprint: 'to92', params: {}, center: { x: 150, y: 200 } },
        },
        {
          ...source,
          id: neighbour.c,
          ref: 'P1',
          kind: 'testpoint',
          pins: [{ id: neighbour.p, uid: neighbour.uid, nc: false }],
          board: {
            ...board,
            footprint: 'point',
            params: { type: 'pad', size: 2 },
            center: { x: 204, y: 214.7 },
          },
        },
      );
    },
  });

  fireEvent.keyDown(svg, { key: 'b' });
  clickPin('1');
  click(svg, 185.6, 214.7);
  fireEvent.keyDown(svg, { key: 'Enter' });
  expect(counts(engine)).toEqual([1, 1]);
  const first = engine.snapshot().doc;
  expect(first.measurements[0]).toMatchObject({ at: neighbour, ref: pinRef('1'), beep: true });
  expect(first.connections[0]).toMatchObject({
    a: { pin: { c: 'cmp_u1', p: '1' } },
    b: { pin: { c: neighbour.c, p: neighbour.p } },
  });

  click(svg, 175.4, 210);
  fireEvent.keyDown(svg, { key: 'Enter' });
  expect(counts(engine)).toEqual([2, 2]);
  expect(engine.snapshot().doc.measurements[1]).toMatchObject({
    at: oval,
    ref: pinRef('1'),
    beep: true,
  });
});
