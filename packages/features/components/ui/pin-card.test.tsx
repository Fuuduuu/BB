// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import type { BoardDoc } from '@pcbk/domain';
import { AppShell, UiRegistry, useSessionStore, useViewStore } from '@pcbk/ui';
import { FakeProjects } from '../../../client/src/__tests__/fakes';
import { idGenerator, setup } from '../../__tests__/helpers';
import { createComponentsUi } from './index';
import { componentEt } from './i18n/et';

beforeEach(() => {
  useSessionStore.getState().reset('feature-test');
  useViewStore.getState().reset();
});
afterEach(cleanup);

function selectPin(id = '3', componentId = 'cmp_u1') {
  act(() => {
    useSessionStore.getState().setSelection({ items: [{ kind: 'pin', componentId, id }] });
  });
}

function mount(readOnly = false) {
  const { engine, host } = setup();
  expect(
    engine.execute('components.add', {
      id: 'cmp_u1',
      ref: 'U1',
      kind: 'ic',
      pins: [
        { id: '1', uid: 'pin_u1_1' },
        { id: '2', uid: 'pin_u1_2' },
        { id: '3', uid: 'pin_u1_3' },
        { id: '4', uid: 'pin_u1_4' },
      ],
    }).ok,
  ).toBe(true);
  if (readOnly) host.load('feature-test', structuredClone(engine.snapshot().doc) as BoardDoc, true);
  host.drainJournal();
  const noop = () => {};
  render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      <AppShell
        registry={new UiRegistry([createComponentsUi(idGenerator())])}
        manageTheme={false}
        onRetrySave={noop}
        onSaveElsewhere={noop}
        onCopyAndReload={noop}
        onExportDiagnostics={noop}
      />
    </EngineProvider>,
  );
  selectPin();
  return { engine, host };
}

test('pin_selection_shows_pin_card_not_component_form', () => {
  mount();
  expect(screen.getByRole('heading', { name: 'U1.3' })).toBeTruthy();
  expect(screen.getByLabelText(componentEt.namePin('3'))).toBeTruthy();
  expect(screen.getByLabelText(componentEt.ncPin('3'))).toBeTruthy();
  expect(screen.queryByLabelText(componentEt.ref)).toBeNull();
  expect(screen.queryByLabelText(componentEt.type)).toBeNull();
  expect(screen.queryByLabelText(componentEt.marking)).toBeNull();
  expect(screen.queryByRole('table')).toBeNull();
  expect(screen.queryByRole('button', { name: componentEt.addPin })).toBeNull();
});

test('pin_card_back_button_selects_component', () => {
  const { engine, host } = mount();
  const before = engine.snapshot();
  fireEvent.click(screen.getByRole('button', { name: '← Komponent' }));
  expect(useSessionStore.getState().selection.items).toEqual([{ kind: 'component', id: 'cmp_u1' }]);
  expect(screen.getByLabelText(componentEt.ref)).toBeTruthy();
  expect(screen.getByRole('table')).toBeTruthy();
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});

test('pin_card_rename_and_nc_use_commands_and_follow_undo_redo', () => {
  const { engine, host } = mount();
  const name = screen.getByLabelText(componentEt.namePin('3')) as HTMLInputElement;
  const nc = screen.getByLabelText(componentEt.ncPin('3')) as HTMLInputElement;
  const before = engine.snapshot().rev;
  fireEvent.change(name, { target: { value: 'GN' } });
  fireEvent.change(name, { target: { value: 'GND' } });
  expect(engine.snapshot().rev).toBe(before);
  fireEvent.keyDown(name, { key: 'Enter' });
  fireEvent.blur(name);
  fireEvent.click(nc);
  expect(engine.snapshot().doc.components[0]!.pins[2]).toEqual({
    id: '3',
    uid: 'pin_u1_3',
    name: 'GND',
    nc: true,
  });
  expect(engine.snapshot().doc.components[0]!.pins[3]!.nc).toBe(false);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'components.renamePin',
    'components.setNc',
  ]);
  act(() => {
    engine.undo();
  });
  expect(nc.checked).toBe(false);
  act(() => {
    engine.undo();
  });
  expect(name.value).toBe('');
  act(() => {
    engine.redo();
    engine.redo();
  });
  expect(name.value).toBe('GND');
  expect(nc.checked).toBe(true);
  fireEvent.change(name, { target: { value: '' } });
  fireEvent.blur(name);
  expect(engine.snapshot().doc.components[0]!.pins[2]!.name).toBeUndefined();
});

test('pin_card_preserves_document_and_shows_read_only_command_errors', () => {
  const { engine, host } = mount(true);
  const before = engine.snapshot();
  const name = screen.getByLabelText(componentEt.namePin('3')) as HTMLInputElement;
  fireEvent.change(name, { target: { value: 'GND' } });
  fireEvent.blur(name);
  expect(screen.getByText(componentEt.readOnly)).toBeTruthy();
  expect(name.value).toBe('GND');
  fireEvent.click(screen.getByLabelText(componentEt.ncPin('3')));
  expect(screen.getAllByText(componentEt.readOnly)).toHaveLength(2);
  expect((screen.getByLabelText(componentEt.ncPin('3')) as HTMLInputElement).checked).toBe(false);
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
  selectPin('4');
  expect(screen.getByRole('heading', { name: 'U1.4' })).toBeTruthy();
  expect((screen.getByLabelText(componentEt.namePin('4')) as HTMLInputElement).value).toBe('');
  expect(screen.queryByText(componentEt.readOnly)).toBeNull();
});

test('pin_card_new_pin_identity_resets_uncommitted_draft', () => {
  const { engine } = mount();
  const input = screen.getByLabelText(componentEt.namePin('3'));
  fireEvent.change(input, { target: { value: 'old draft' } });
  act(() => {
    expect(engine.execute('components.removePin', { id: 'cmp_u1', pinId: '3' }).ok).toBe(true);
    expect(
      engine.execute('components.addPin', {
        id: 'cmp_u1',
        pin: { id: '3', uid: 'pin_replacement_3' },
      }).ok,
    ).toBe(true);
  });
  expect((screen.getByLabelText(componentEt.namePin('3')) as HTMLInputElement).value).toBe('');
});
