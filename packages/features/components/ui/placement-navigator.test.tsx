// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import { useSessionStore } from '@pcbk/ui';
import { FakeProjects } from '../../../client/src/__tests__/fakes';
import { idGenerator, setup } from '../../__tests__/helpers';
import { createComponentsUi } from './index';
import { usePlaceStore } from './place-store';

beforeEach(() => {
  useSessionStore.getState().reset('feature-test');
  usePlaceStore.getState().reset();
});
afterEach(cleanup);

function mount(tabId: string, engine = setup().engine) {
  const module = createComponentsUi(idGenerator());
  const tab = module.navigatorTabs?.find((panel) => panel.id === tabId);
  expect(tab).toBeDefined();
  render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      {tab!.render()}
    </EngineProvider>,
  );
}

test('library_lists_five_footprint_families_and_unknown', () => {
  mount('library');
  const rows = screen.getAllByRole('listitem');
  const names = [
    'Takisti SMD',
    'Kondensaator SMD',
    'SOT-23',
    'SOIC',
    'TO-220',
    'Pinnirida 1×N',
    'Tundmatu komponent',
  ];
  expect(rows).toHaveLength(names.length);
  names.forEach((name, index) => {
    expect(within(rows[index]!).getByRole('button', { name })).toBeTruthy();
  });
  expect(
    screen.getByRole('button', {
      name: 'Tundmatu komponent',
      description: 'Kohandatud korpus',
    }),
  ).toBeTruthy();
});

test('search_filters_by_keyword_and_shows_empty_state', () => {
  mount('library');
  const search = screen.getByRole('searchbox');
  fireEvent.change(search, { target: { value: '  TAKISTI   chip  ' } });
  expect(screen.getByRole('button', { name: 'Takisti SMD' })).toBeTruthy();
  expect(screen.getAllByRole('listitem')).toHaveLength(1);

  fireEvent.change(search, { target: { value: 'mosfet' } });
  expect(screen.getByRole('button', { name: 'SOT-23' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'TO-220' })).toBeTruthy();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);

  fireEvent.change(search, { target: { value: 'takisti mosfet' } });
  expect(screen.queryByRole('listitem')).toBeNull();
  expect(screen.getByText(/Sellist korpust ei leitud/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Kohandatud' }));
  expect((search as HTMLInputElement).value).toBe('');
  expect(
    screen.getByRole('button', { name: /Tundmatu komponent/ }).getAttribute('aria-expanded'),
  ).toBe('true');
  const width = screen.getByLabelText<HTMLInputElement>('Laius (mm)');
  const place = screen.getByRole<HTMLButtonElement>('button', { name: 'Paiguta' });
  expect(width.value).toBe('8');
  fireEvent.change(width, { target: { value: '0' } });
  expect(place.disabled).toBe(true);
  fireEvent.change(width, { target: { value: '12,5' } });
  fireEvent.click(place);
  expect(usePlaceStore.getState().request).toEqual({
    mode: 'new',
    entryId: 'unknown',
    params: { w: 12.5, h: 10 },
  });
});

function mountUnplaced(pinIds: string[]) {
  const { engine } = setup();
  const result = engine.execute('components.add', {
    id: 'cmp_test',
    kind: 'ic',
    pins: pinIds.map((id, index) => ({ id, uid: `pin_${index}` })),
  });
  expect(result.ok).toBe(true);
  mount('unplaced', engine);
  fireEvent.click(screen.getByRole('button', { name: 'Paiguta plaadile' }));
  return engine;
}

test('unplaced_list_places_matching_footprint_only', () => {
  const engine = mountUnplaced(['6', '4', '2', '5', '1', '3']);
  const before = engine.snapshot();
  const chip = screen.getByRole<HTMLButtonElement>('button', { name: 'Takisti SMD' });
  expect(chip.disabled).toBe(true);
  fireEvent.click(chip);
  expect(useSessionStore.getState().toolId).toBe('select');
  const sot23 = screen.getByRole<HTMLButtonElement>('button', { name: 'SOT-23' });
  expect(sot23.disabled).toBe(false);
  fireEvent.click(sot23);
  expect(useSessionStore.getState().toolId).toBe('components.place');
  expect(usePlaceStore.getState().request).toEqual({
    mode: 'existing',
    componentId: 'cmp_test',
    footprint: 'sot23',
    params: { pins: 6 },
  });
  expect(engine.snapshot()).toBe(before);
});

test('incompatible_footprint_shows_reason', () => {
  mountUnplaced(['1', 'GND']);
  const chip = screen.getByRole<HTMLButtonElement>('button', { name: 'Takisti SMD' });
  expect(chip.disabled).toBe(true);
  expect(document.getElementById(chip.getAttribute('aria-describedby')!)?.textContent).toBe(
    'Jalgade nimed ei sobi',
  );
  const sot23 = screen.getByRole<HTMLButtonElement>('button', { name: 'SOT-23' });
  expect(sot23.disabled).toBe(true);
  expect(document.getElementById(sot23.getAttribute('aria-describedby')!)?.textContent).toBe(
    'Jalad ei sobi: komponendil 2, korpusel 3',
  );
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: /Tundmatu komponent/ }).disabled,
  ).toBe(false);
});
