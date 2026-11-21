// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import type { Vec2 } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { mountMeasurements, pointer } from '../../measurements/__tests__/workspace';

const crossingHint = 'Sama kihi rajad ei saa ristuda. Vaheta kiht (L) või lõpeta raja peal (haru).';

function click(svg: SVGSVGElement, { x, y }: Vec2) {
  pointer(svg, 'pointerdown', x, y);
  pointer(svg, 'pointerup', x, y);
}

test('trace_tool_rejects_same_layer_crossing', () => {
  const { engine, svg, clickPin, pinPoint } = mountMeasurements({
    seed(doc) {
      doc.junctions.push(
        { id: 'jun_left', board: { at: { x: 70, y: 200 }, layer: 'top' } },
        { id: 'jun_right', board: { at: { x: 290, y: 200 }, layer: 'top' } },
      );
      doc.connections.push({
        id: 'con_horizontal',
        a: { junction: 'jun_left' },
        b: { junction: 'jun_right' },
        basis: 'visual',
        board: { kind: 'trace', layer: 'top', widthMm: 0.4, waypoints: [] },
      });
    },
  });
  const original = engine.snapshot().doc;
  const beforeCrossing = { x: 160, y: 170 };
  const pastCrossing = { x: 160, y: 230 };
  const cue = () => svg.querySelector('[data-trace-crossing]');
  const hint = () => screen.queryByText((text) => text.endsWith(crossingHint));

  function begin() {
    fireEvent.keyDown(svg, { key: 'Escape' });
    fireEvent.keyDown(svg, { key: 't' });
    clickPin('1');
  }

  function undo() {
    act(() => expect(engine.undo().ok).toBe(true));
    expect(engine.snapshot().doc.connections).toEqual(original.connections);
  }

  begin();
  click(svg, beforeCrossing);
  pointer(svg, 'pointermove', pastCrossing.x, pastCrossing.y);
  expect.soft(cue()?.tagName.toLowerCase()).toBe('circle');
  expect.soft(cue()?.getAttribute('cx')).toBe('160');
  expect.soft(cue()?.getAttribute('cy')).toBe('200');
  expect.soft(cue()?.getAttribute('stroke')).toBe('var(--danger)');
  expect.soft(hint()).not.toBeNull();
  click(svg, pastCrossing);
  pointer(svg, 'pointermove', 170, 230);
  const points = svg.querySelector('[data-trace-preview] polyline')?.getAttribute('points');
  const start = pinPoint('1');
  expect.soft(points?.split(' ')).toEqual([`${start.x},${start.y}`, '160,170', '170,230']);
  expect(engine.snapshot().doc).toBe(original);

  for (const kind of ['trace', 'wire'] as const) {
    begin();
    fireEvent.keyDown(svg, { key: 'l' });
    if (kind === 'wire') fireEvent.keyDown(svg, { key: 'l' });
    click(svg, beforeCrossing);
    pointer(svg, 'pointermove', pastCrossing.x, pastCrossing.y);
    expect(cue()).toBeNull();
    click(svg, pastCrossing);
    clickPin('2');
    expect(engine.snapshot().doc.connections.at(-1)?.board).toMatchObject({
      kind,
      layer: 'bottom',
      waypoints: [beforeCrossing, pastCrossing],
    });
    expect(engine.snapshot().doc.junctions).toEqual(original.junctions);
    undo();
  }

  begin();
  click(svg, { x: 180, y: 200 });
  expect(engine.snapshot().doc.connections).toHaveLength(3);
  expect(engine.snapshot().doc.junctions.at(-1)?.board).toEqual({
    at: { x: 180, y: 200 },
    layer: 'top',
  });
  undo();

  fireEvent.keyDown(svg, { key: 'Escape' });
  fireEvent.keyDown(svg, { key: 't' });
  click(svg, { x: 70, y: 200 });
  pointer(svg, 'pointermove', 320, 200);
  expect.soft(cue()).not.toBeNull();
  expect.soft(hint()).not.toBeNull();
  click(svg, { x: 320, y: 200 });
  pointer(svg, 'pointermove', 335, 200);
  expect
    .soft(svg.querySelector('[data-trace-preview] polyline')?.getAttribute('points'))
    .toBe('70,200 335,200');
  expect(engine.snapshot().doc.connections).toEqual(original.connections);
});
