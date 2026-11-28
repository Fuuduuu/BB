// @vitest-environment jsdom
import { EngineProvider, useSnapshot } from '@pcbk/client';
import { newBoardDoc } from '@pcbk/domain';
import type { Component } from '@pcbk/domain';
import { UiRegistry, useSessionStore } from '@pcbk/ui';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { FakeProjects } from '../../../client/src/__tests__/fakes';
import { setupWithAllFeatures } from '../../__tests__/helpers';
import { createSchematicUi } from './index';

function component(
  id: string,
  ref: string,
  kind: Component['kind'],
  pinCount: number,
  placed = true,
): Component {
  return {
    id,
    ref,
    kind,
    identified: true,
    marking: '',
    value: '',
    dnp: false,
    note: '',
    pins: Array.from({ length: pinCount }, (_, index) => ({
      id: String(index + 1),
      uid: `pin_${id}_${index + 1}`,
      nc: false,
    })),
    ...(placed && {
      schematic: { symbol: 'box', at: { x: 25.4, y: 25.4 }, rot: 0, mirror: false },
    }),
  };
}

afterEach(() => {
  cleanup();
  useSessionStore.getState().reset('');
});

test('pin_function_section_turns_box_into_symbol', () => {
  const npn = component('cmp_npn', 'Q1', 'npn', 3);
  const fourPins = component('cmp_four', 'Q2', 'npn', 4);
  const resistor = component('cmp_r1', 'R1', 'resistor', 2);
  const unplaced = component('cmp_unplaced', 'Q3', 'npn', 3, false);
  const doc = newBoardDoc('Sünteetiline transistorite skeem');
  doc.components.push(npn, fourPins, resistor, unplaced);
  const { engine } = setupWithAllFeatures(doc);
  const registry = new UiRegistry([createSchematicUi()]);
  const layer = registry.schematicLayers()[0]!;
  const session = useSessionStore.getState();
  session.reset(engine.snapshot().sessionId);
  function select(id: string) {
    act(() => session.setSelection({ items: [{ kind: 'component', id }] }));
  }

  function Screen() {
    const snapshot = useSnapshot((current) => current);
    const selection = useSessionStore((state) => state.selection);
    return (
      <>
        {registry.contextSections(selection).map((section) => (
          <div key={section.id}>{section.render({ selection })}</div>
        ))}
        <svg>{layer.render({ snapshot, zoom: 6, preview: null })}</svg>
      </>
    );
  }

  select(npn.id);
  const { container } = render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      <Screen />
    </EngineProvider>,
  );
  const symbol = () =>
    container.querySelector('[data-component="cmp_npn"]')?.getAttribute('data-symbol');
  expect(symbol()).toBe('box');
  expect(screen.getByRole('heading', { name: 'Jalgade funktsioon' })).toBeTruthy();
  expect(
    screen.getByText('Jalgade nimed ei anna funktsiooni üheselt. Skeemil on komponent kastina.'),
  ).toBeTruthy();

  const b = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Kontakt B' });
  const c = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Kontakt C' });
  const e = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Kontakt E' });
  expect([b.value, c.value, e.value]).toEqual(['', '', '']);
  expect(Array.from(b.options, (option) => option.textContent)).toEqual(['—', '1', '2', '3']);
  const save = screen.getByRole<HTMLButtonElement>('button', { name: 'Salvesta' });
  expect(save.disabled).toBe(true);

  fireEvent.change(b, { target: { value: '2' } });
  fireEvent.change(c, { target: { value: '2' } });
  fireEvent.change(e, { target: { value: '3' } });
  expect(save.disabled).toBe(true);
  fireEvent.change(c, { target: { value: '1' } });
  expect(save.disabled).toBe(false);
  fireEvent.click(save);
  expect(symbol()).toBe('npn');
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Salvesta' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Kasuta jalgade nimesid' }));
  expect(symbol()).toBe('box');

  select(fourPins.id);
  expect(
    screen.getByText('Sümbolil on 3 kontakti, komponendil 4 jalga. Skeemil on see kastina.'),
  ).toBeTruthy();
  expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  expect(screen.queryByRole('button', { name: 'Salvesta' })).toBeNull();

  select(resistor.id);
  expect(screen.queryByRole('heading', { name: 'Jalgade funktsioon' })).toBeNull();
  select(unplaced.id);
  expect(screen.queryByRole('heading', { name: 'Jalgade funktsioon' })).toBeNull();
});
