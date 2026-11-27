// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { mountMeasurements, pointer, seedRemovablePins } from './measurements/__tests__/workspace';

const end = (p: string) => ({ pin: { c: 'cmp_u1', p } });

test('black_probe_and_trace_take_the_pad_under_the_cursor', () => {
  const { engine, svg, clickPin } = mountMeasurements({
    seed(doc) {
      seedRemovablePins(doc);
      const pads = doc.components[0]!.board!.customPads;
      pads['1'] = { ...pads['1']!, local: { x: -4, y: 0 }, sizeMm: 2 };
      pads['2'] = { ...pads['2']!, local: { x: -2.5, y: 0 }, sizeMm: 0.5 };
    },
  });

  function clickBetweenPadCenters() {
    // The click is 9.5 px from the large pad's center and 5.5 px from the small one's.
    pointer(svg, 'pointerdown', 129.5, 100);
    pointer(svg, 'pointerup', 129.5, 100);
  }

  clickPin('3');
  const blackProbe = screen.getByRole('group', { name: 'Must sond' });
  fireEvent.click(within(blackProbe).getByRole('button', { name: 'Vali musta sondi jalg' }));
  clickBetweenPadCenters();
  expect.soft(blackProbe.textContent, 'black probe').toContain('Must sond · U1.1');

  fireEvent.keyDown(svg, { key: 't' });
  clickBetweenPadCenters();
  clickPin('4');
  expect
    .soft(engine.snapshot().doc.connections, 'trace start')
    .toMatchObject([{ a: end('1'), b: end('4'), board: { kind: 'trace' } }]);

  act(() => {
    expect(engine.undo().ok).toBe(true);
  });
  clickPin('4');
  clickBetweenPadCenters();
  expect
    .soft(engine.snapshot().doc.connections, 'trace finish')
    .toMatchObject([{ a: end('4'), b: end('1'), board: { kind: 'trace' } }]);
});
