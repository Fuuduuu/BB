// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import type { BoardDoc } from '@pcbk/domain';
import { useSessionStore } from '@pcbk/ui';
import { expect, test } from 'vitest';
import { mountMeasurements, pinRef } from '../../measurements/__tests__/workspace';

const sourceIds = ['cmp_u1', 'cmp_duplicate_second'] as const;

function seedDuplicates(doc: BoardDoc) {
  const first = doc.components[0]!;
  first.ref = 'J1';
  first.marking = 'HDR';
  first.value = '4+1';
  first.note = 'Algse pistiku märkus';
  first.dnp = true;
  first.schematic = { symbol: 'header', at: { x: 50, y: 80 }, rot: 90, mirror: true };
  first.pins[0]!.nc = true;
  first.pins.push({ id: '9', uid: 'pin_extra_9', name: 'Test', nc: false });
  Object.assign(first.board!, {
    rotationDeg: 30,
    side: 'bottom',
    scaleX: 1.25,
    scaleY: 0.8,
    customPads: { '9': { local: { x: 3.5, y: 2 }, sizeMm: 1, shape: 'circle', through: false } },
    padMap: { '1': '2', '2': '1' },
    labelOffset: { x: 3, y: -4 },
  });
  const second = structuredClone(first);
  second.id = sourceIds[1];
  second.ref = 'J2';
  second.identified = false;
  second.board!.center = { x: 350, y: 170 };
  for (const pin of second.pins) pin.uid = `pin_second_${pin.id}`;
  doc.components.push(second);
  doc.measurements.push({
    id: 'msr_duplicate_source',
    mode: 'voltage',
    at: pinRef('1'),
    atLabel: 'J1.1',
    value: 4.98,
    power: 'on',
    takenAt: '2026-11-10T10:00:00Z',
    source: 'manual',
  });
}

test('duplicate_ctrl_d_gives_new_ref_and_uids_without_measurements', () => {
  const { engine, host, svg } = mountMeasurements({ seed: seedDuplicates });
  const original = engine.snapshot().doc;
  const selectSources = () =>
    act(() =>
      useSessionStore.getState().setSelection({
        items: sourceIds.map((id) => ({ kind: 'component', id })),
      }),
    );
  const undo = () => {
    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
    expect(engine.snapshot().doc.components).toEqual(original.components);
    expect(host.drainJournal()).toEqual([expect.objectContaining({ kind: 'undo' })]);
  };
  function readCopies() {
    expect(host.drainJournal()).toEqual([
      expect.objectContaining({ kind: 'command', commandId: 'components.duplicate' }),
    ]);
    const doc = engine.snapshot().doc;
    expect(doc.components.slice(0, 2)).toEqual(original.components);
    expect(doc.measurements).toEqual(original.measurements);
    const copies = doc.components.slice(2);
    expect(copies.map(({ ref }) => ref)).toEqual(['J3', 'J4']);
    expect(useSessionStore.getState().selection.items).toEqual(
      copies.map(({ id }) => ({ kind: 'component', id })),
    );
    return copies;
  }

  selectSources();
  const handled = fireEvent.keyDown(svg, { key: 'd', ctrlKey: true });
  const copies = readCopies();
  expect(handled).toBe(false);
  const componentIds = new Set<string>(sourceIds);
  const uids = new Set(original.components.flatMap(({ pins }) => pins.map(({ uid }) => uid)));
  for (const [index, copy] of copies.entries()) {
    const source = original.components[index]!;
    expect(copy.id).toMatch(/^cmp_/);
    expect(componentIds.has(copy.id)).toBe(false);
    componentIds.add(copy.id);
    expect(copy).toMatchObject({
      kind: source.kind,
      marking: source.marking,
      value: source.value,
      identified: source.identified,
      note: '',
      dnp: false,
    });
    expect(copy.schematic).toBeUndefined();
    const board = source.board!;
    expect(copy.board).toEqual({
      ...board,
      center: { x: board.center.x + 20, y: board.center.y + 20 },
    });
    const pinFields = ({ id, name, nc }: BoardDoc['components'][number]['pins'][number]) => ({
      id,
      name,
      nc,
    });
    expect(copy.pins.map(pinFields)).toEqual(source.pins.map(pinFields));
    for (const { uid } of copy.pins) {
      expect(uid).toMatch(/^pin_/);
      expect(uids.has(uid)).toBe(false);
      uids.add(uid);
    }
  }
  fireEvent.keyDown(svg, { key: 'd', ctrlKey: true, repeat: true });
  expect(host.drainJournal()).toEqual([]);
  undo();

  selectSources();
  fireEvent.contextMenu(svg, { button: 2, clientX: 160, clientY: 100 });
  const menu = within(screen.getByRole('menu', { name: 'Toimingud' }));
  const duplicate = menu.getByRole('menuitem', { name: /Dubleeri/ });
  expect(duplicate.getAttribute('aria-keyshortcuts')).toBe('Control+D');
  expect(within(duplicate).getByText('Ctrl+D')).toBeTruthy();
  fireEvent.click(duplicate);
  readCopies();
  undo();

  const before = engine.snapshot();
  expect(fireEvent.keyDown(svg, { key: 'd', ctrlKey: true })).toBe(false);
  act(() =>
    useSessionStore.getState().setSelection({
      items: [{ kind: 'pin', id: '1', componentId: sourceIds[0] }],
    }),
  );
  expect(fireEvent.keyDown(svg, { key: 'd', metaKey: true })).toBe(false);
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});
