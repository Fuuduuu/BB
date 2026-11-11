// @vitest-environment jsdom
import { componentEt } from './i18n/et';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import { et, useSessionStore } from '@pcbk/ui';
import { FakeProjects } from '../../../client/src/__tests__/fakes';
import { idGenerator, setup } from '../../__tests__/helpers';
import { createComponentsUi } from './index';
import { commandError } from './errors';

test('ui_shows_internal_error_text', () => {
  expect(commandError({ code: 'internal', message: 'private implementation detail' })).toBe(
    'Sisemine viga, muudatust ei tehtud. Salvesta diagnostika ja anna veast teada.',
  );
});

const dialogMethods = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
};
beforeEach(() => {
  useSessionStore.getState().reset('feature-test');
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});
afterEach(() => {
  cleanup();
  for (const name of ['showModal', 'close'] as const) {
    const original = dialogMethods[name];
    if (original) Object.defineProperty(HTMLDialogElement.prototype, name, original);
    else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>)[name];
  }
});
function mount() {
  const { engine, host } = setup();
  const module = createComponentsUi(idGenerator());
  function Screen() {
    const selection = useSessionStore((s) => s.selection);
    return (
      <>
        {module.navigatorTabs?.find((tab) => tab.id === 'unplaced')?.render()}
        {module.contextSections![0]!.render({ selection })}
      </>
    );
  }
  render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      <Screen />
    </EngineProvider>,
  );
  return { engine, host };
}
function add(kind?: string, count?: string) {
  fireEvent.click(screen.getByRole('button', { name: componentEt.add }));
  const dialog = within(screen.getByRole('dialog', { name: componentEt.addTitle }));
  if (kind) fireEvent.change(dialog.getByLabelText(componentEt.type), { target: { value: kind } });
  if (count !== undefined)
    fireEvent.change(dialog.getByLabelText(componentEt.pinCount), { target: { value: count } });
  fireEvent.click(dialog.getByRole('button', { name: componentEt.add }));
}
function edit(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

test('adding a resistor selects it with two stable pin identities and empty factual fields', () => {
  const { engine } = mount();
  add();
  expect(engine.snapshot().doc.components[0]).toMatchObject({
    id: 'cmp_1',
    ref: 'R1',
    kind: 'resistor',
    value: '',
    marking: '',
    pins: [
      { id: '1', uid: 'pin_2', nc: false },
      { id: '2', uid: 'pin_3', nc: false },
    ],
  });
  expect(useSessionStore.getState().selection).toEqual({
    items: [{ kind: 'component', id: 'cmp_1' }],
  });
  expect(screen.getByRole('button', { name: componentEt.select('R1') }).textContent).toContain(
    'Takisti',
  );
  expect((screen.getByLabelText(componentEt.value) as HTMLInputElement).value).toBe('');
  expect((screen.getByLabelText(componentEt.value) as HTMLInputElement).placeholder).toContain(
    '10 kΩ',
  );
  expect((screen.getByLabelText(componentEt.marking) as HTMLInputElement).value).toBe('');
});

test('a reference draft creates one undo step on Enter and tracks undo and redo', () => {
  const { engine } = mount();
  add();
  const input = screen.getByLabelText(componentEt.ref) as HTMLInputElement;
  const before = engine.snapshot().rev;
  fireEvent.change(input, { target: { value: 'R' } });
  fireEvent.change(input, { target: { value: 'R7' } });
  expect(engine.snapshot().rev).toBe(before);
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.blur(input);
  expect(engine.snapshot().rev).toBe(before + 1);
  expect(screen.getByRole('button', { name: componentEt.select('R7') })).toBeTruthy();
  act(() => {
    engine.undo();
  });
  expect(input.value).toBe('R1');
  act(() => {
    engine.redo();
  });
  expect(input.value).toBe('R7');
});

test('undo replaces a rejected reference draft with the restored value and clears the error', () => {
  const { engine } = mount();
  add();
  add();
  fireEvent.click(screen.getByRole('button', { name: componentEt.select('R1') }));
  edit(componentEt.ref, 'R7');
  const input = screen.getByLabelText(componentEt.ref) as HTMLInputElement;
  edit(componentEt.ref, 'R2');
  expect(input.value).toBe('R2');
  expect(screen.getByText(componentEt.duplicateRef)).toBeTruthy();

  act(() => {
    engine.undo();
  });

  expect(engine.snapshot().doc.components[0]!.ref).toBe('R1');
  expect(input.value).toBe('R1');
  expect(screen.queryByText(componentEt.duplicateRef)).toBeNull();
});

test('Escape cancels a draft without a document command', () => {
  const { engine } = mount();
  add();
  const input = screen.getByLabelText(componentEt.ref) as HTMLInputElement;
  const before = engine.snapshot();
  fireEvent.change(input, { target: { value: 'R88' } });
  fireEvent.keyDown(input, { key: 'Escape' });
  fireEvent.blur(input);
  expect(input.value).toBe('R1');
  expect(engine.snapshot()).toBe(before);
});

test('duplicate and empty references retain the draft with friendly feedback until corrected', () => {
  const { engine } = mount();
  add();
  add();
  const before = engine.snapshot();
  edit(componentEt.ref, 'r1');
  expect(engine.snapshot()).toBe(before);
  expect((screen.getByLabelText(componentEt.ref) as HTMLInputElement).value).toBe('r1');
  expect(screen.getByText(componentEt.duplicateRef)).toBeTruthy();
  edit(componentEt.note, 'Vaata hiljem');
  expect((screen.getByLabelText(componentEt.ref) as HTMLInputElement).value).toBe('r1');
  expect(screen.getByText(componentEt.duplicateRef)).toBeTruthy();
  edit(componentEt.ref, '');
  expect(screen.getByText(componentEt.invalid)).toBeTruthy();
  edit(componentEt.ref, 'R9');
  expect(engine.snapshot().doc.components[1]!.ref).toBe('R9');
  expect(screen.queryByText(componentEt.duplicateRef)).toBeNull();
});

test('component fields and checkboxes change only the explicit factual fields', () => {
  const { engine } = mount();
  add();
  edit(componentEt.value, '10 kΩ');
  edit(componentEt.marking, '103');
  edit(componentEt.note, 'Kontrollida');
  fireEvent.change(screen.getByLabelText(componentEt.type), { target: { value: 'capacitor' } });
  fireEvent.click(screen.getByLabelText(componentEt.identified));
  fireEvent.click(screen.getByLabelText(componentEt.dnp));
  expect(engine.snapshot().doc.components[0]).toMatchObject({
    ref: 'R1',
    kind: 'capacitor',
    value: '10 kΩ',
    marking: '103',
    note: 'Kontrollida',
    identified: true,
    dnp: true,
  });
  edit(componentEt.value, '');
  expect(engine.snapshot().doc.components[0]!.value).toBe('');
});

test('pin edits, NC, remove and add preserve survivor identities and are undoable', () => {
  const { engine } = mount();
  add();
  edit(componentEt.namePin('1'), 'GND');
  fireEvent.click(screen.getByLabelText(componentEt.ncPin('1')));
  expect(engine.snapshot().doc.components[0]!.pins[0]).toMatchObject({
    name: 'GND',
    nc: true,
    uid: 'pin_2',
  });
  fireEvent.click(screen.getByRole('button', { name: componentEt.removePin('2') }));
  fireEvent.click(screen.getByRole('button', { name: componentEt.addPin }));
  expect(engine.snapshot().doc.components[0]!.pins).toEqual([
    { id: '1', uid: 'pin_2', name: 'GND', nc: true },
    { id: '2', uid: 'pin_4', nc: false },
  ]);
  act(() => {
    engine.undo();
    engine.undo();
  });
  expect(engine.snapshot().doc.components[0]!.pins[1]).toEqual({
    id: '2',
    uid: 'pin_3',
    nc: false,
  });
  edit(componentEt.namePin('1'), '');
  expect(engine.snapshot().doc.components[0]!.pins[0]!.name).toBeUndefined();
});

test('the add dialog validates an integer pin count and can create an explicit IC pin count', () => {
  const { engine } = mount();
  add('ic', '1.5');
  expect(engine.snapshot().doc.components).toHaveLength(0);
  expect(screen.getByText(componentEt.pinCountInvalid)).toBeTruthy();
  fireEvent.change(screen.getByLabelText(componentEt.pinCount), { target: { value: '8' } });
  const dialog = within(screen.getByRole('dialog', { name: componentEt.addTitle }));
  fireEvent.click(dialog.getByRole('button', { name: componentEt.add }));
  expect(engine.snapshot().doc.components[0]).toMatchObject({ kind: 'ic', ref: 'U1' });
  expect(engine.snapshot().doc.components[0]!.pins.map((pin) => pin.id)).toEqual([
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
  ]);
});

test.each(['', '-1', '257', '9007199254740992'])(
  'invalid pin count %s never allocates a component',
  (count) => {
    const { engine } = mount();
    add('ic', count);
    expect(engine.snapshot().doc.components).toHaveLength(0);
    expect(screen.getByText(componentEt.pinCountInvalid)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: et.common.cancel }));
    add();
    expect(engine.snapshot().doc.components[0]!.id).toBe('cmp_1');
  },
);

test('a mechanical hole has no pins and selecting an earlier component shows its own drafts', () => {
  const { engine } = mount();
  add();
  add('hole');
  expect(engine.snapshot().doc.components[1]).toMatchObject({ kind: 'hole', pins: [] });
  expect(screen.getByText(componentEt.noPins)).toBeTruthy();
  fireEvent.change(screen.getByLabelText(componentEt.ref), { target: { value: 'unfinished' } });
  fireEvent.click(screen.getByRole('button', { name: componentEt.select('R1') }));
  expect((screen.getByLabelText(componentEt.ref) as HTMLInputElement).value).toBe('R1');
  act(() => {
    useSessionStore
      .getState()
      .setSelection({ items: [{ kind: 'pin', componentId: 'cmp_1', id: '1' }] });
  });
  expect(screen.getByLabelText(componentEt.namePin('1'))).toBeTruthy();
});
