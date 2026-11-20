// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { mountMeasurements, pointer } from '../../measurements/__tests__/workspace';

test('stamp_uses_params_changed_during_placement', () => {
  const app = mountMeasurements({
    seed(doc) {
      doc.components = [];
    },
  });
  const { engine, svg } = app;
  fireEvent.click(screen.getByRole('tab', { name: 'Teek' }));
  const library = within(screen.getByRole('tabpanel', { name: 'Teek' }));
  const ghost = () => svg.querySelector('[data-placement-ghost]');
  const ghostPads = () => ghost()?.querySelectorAll('[data-pad]') ?? [];
  const outline = () => ghost()?.querySelector('polygon')?.getAttribute('points');
  function start(entry: string, x: number, y: number) {
    fireEvent.click(library.getByRole('button', { name: entry }));
    fireEvent.click(library.getByRole('button', { name: 'Paiguta' }));
    pointer(svg, 'pointermove', x, y);
  }
  function clickBoard(x: number, y: number) {
    pointer(svg, 'pointerdown', x, y);
    pointer(svg, 'pointerup', x, y);
  }

  start('SOIC', 180, 150);
  expect(ghostPads()).toHaveLength(8);
  fireEvent.change(library.getByRole('combobox', { name: 'Jalgu' }), {
    target: { value: '16' },
  });
  expect(library.getByRole('img', { name: 'Pealtvaade: SOIC, 16 jalga' })).toBeTruthy();
  const previewPinCount = ghostPads().length;
  clickBoard(180, 150);
  const soic = engine.snapshot().doc.components[0]!;
  expect(soic.pins).toHaveLength(16);
  expect(soic.board).toMatchObject({ footprint: 'soic', params: { pins: 16 } });
  expect(previewPinCount).toBe(16);
  fireEvent.keyDown(window, { key: 'Escape' });

  start('Takisti SMD', 320, 150);
  expect(outline()).toBe('310,143.75 330,143.75 330,156.25 310,156.25');
  fireEvent.change(library.getByRole('combobox', { name: 'Korpus' }), {
    target: { value: '2512' },
  });
  expect(outline()).toBe('288.5,134 351.5,134 351.5,166 288.5,166');
  clickBoard(320, 150);
  expect(engine.snapshot().doc.components[1]?.board).toMatchObject({
    footprint: 'chip',
    params: { size: '2512' },
  });
  fireEvent.keyDown(window, { key: 'Escape' });

  start('Kohandatud', 400, 300);
  expect(ghostPads()).toHaveLength(8);
  const pins = library.getByRole('textbox', { name: 'Jalgu' });
  fireEvent.change(pins, { target: { value: '201' } });
  expect(library.getByText('Kontrolli parameetreid')).toBeTruthy();
  expect(ghost()).toBeNull();
  const beforeInvalidClick = engine.snapshot();
  clickBoard(400, 300);
  expect(engine.snapshot()).toBe(beforeInvalidClick);

  fireEvent.change(pins, { target: { value: '12' } });
  expect(ghostPads()).toHaveLength(12);
  expect(outline()).toBe('360,250 440,250 440,350 360,350');
  clickBoard(400, 300);
  const custom = engine.snapshot().doc.components[2]!;
  expect(custom.pins).toHaveLength(12);
  expect(custom.board).toMatchObject({ footprint: 'custom', center: { x: 400, y: 300 } });
});
