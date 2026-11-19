// @vitest-environment jsdom
import { fireEvent } from '@testing-library/react';
import { useSessionStore } from '@pcbk/ui';
import { expect, test } from 'vitest';
import { mountMeasurements } from '../../measurements/__tests__/workspace';

test('frame_selects_components_fully_inside', () => {
  const app = mountMeasurements({
    seed(doc) {
      const original = doc.components[0]!;
      for (const [id, ref, x] of [
        ['cmp_u2', 'U2', 260],
        ['cmp_u3', 'U3', 360],
      ] as const) {
        doc.components.push({
          ...original,
          id,
          ref,
          pins: original.pins.map((pin) => ({ ...pin, uid: `pin_${id}_${pin.id}` })),
          board: { ...original.board!, center: { x, y: 100 } },
        });
      }
    },
  });
  const svg = app.svg;
  const pointer = (type: string, x: number, y: number, shiftKey = false) => {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, shiftKey });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    fireEvent(svg, event);
  };
  const frame = () => svg.querySelector('[data-selection-frame]');
  const selection = () => useSessionStore.getState().selection.items;
  const picked = (...ids: string[]) => ids.map((id) => ({ kind: 'component', id }));

  pointer('pointerdown', 290, 140);
  pointer('pointermove', 100, 60);
  expect(frame()).not.toBeNull();
  expect(frame()?.getAttribute('x')).toBe('100');
  expect(frame()?.getAttribute('y')).toBe('60');
  expect(frame()?.getAttribute('width')).toBe('190');
  expect(frame()?.getAttribute('height')).toBe('80');
  expect(frame()?.getAttribute('stroke-dasharray')).toBeTruthy();
  expect(frame()?.getAttribute('vector-effect')).toBe('non-scaling-stroke');
  expect(selection()).toEqual([]);
  pointer('pointerup', 100, 60);
  expect(frame()).toBeNull();
  expect(selection()).toEqual(picked('cmp_u1'));

  for (const x of [208, 100]) {
    pointer('pointerdown', x, 60, true);
    pointer('pointermove', 420, 140);
    pointer('pointerup', 420, 140);
    expect(frame()).toBeNull();
    expect(selection()).toEqual(picked('cmp_u1', 'cmp_u2', 'cmp_u3'));
  }

  pointer('pointerdown', 100, 60);
  pointer('pointermove', 290, 140);
  pointer('pointermove', 101, 60);
  pointer('pointerup', 101, 60);
  expect(frame()).toBeNull();
  expect(selection()).toEqual(picked('cmp_u1', 'cmp_u2', 'cmp_u3'));

  pointer('pointerdown', 100, 60);
  pointer('pointermove', 290, 140);
  expect(frame()).not.toBeNull();
  fireEvent.keyDown(svg, { key: 'Escape' });
  expect(frame()).toBeNull();
  expect(selection()).toEqual([]);
  pointer('pointerup', 100, 60);
  expect(selection()).toEqual([]);
  expect(app.engine.snapshot().history.canUndo).toBe(false);
});
