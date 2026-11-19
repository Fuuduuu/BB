// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { useSessionStore, useViewStore } from '@pcbk/ui';
import { expect, test } from 'vitest';
import { mountMeasurements, pointer } from '../../measurements/__tests__/workspace';

const ids = ['cmp_u2', 'cmp_u3', 'cmp_u4'];
const start = { x: 280, y: 140 };

test('multi_selection_action_is_one_undo_step', () => {
  const { engine, host, svg } = mountMeasurements({
    seed(doc) {
      ids.forEach((id, index) => {
        const component = structuredClone(doc.components[0]!);
        component.id = id;
        component.ref = 'U' + (index + 2);
        for (const pin of component.pins) pin.uid = 'pin_' + id + '_' + pin.id;
        component.board!.center = { x: start.x + index * 110, y: start.y + index * 40 };
        doc.components.push(component);
      });
      doc.measurements.push({
        id: 'msr_multi',
        mode: 'voltage',
        at: { c: 'cmp_u2', p: '1', uid: 'pin_cmp_u2_1' },
        atLabel: 'U2.1',
        value: 4.73,
        power: 'on',
        takenAt: '2026-11-10T10:00:00.000Z',
        source: 'manual',
      });
    },
  });
  const selection = {
    items: [
      ...ids.map((id) => ({ kind: 'component', id })),
      { kind: 'pin', id: '1', componentId: 'cmp_u1' },
    ],
  };
  const read = () => engine.snapshot().doc;
  const original = read();
  const selected = () => read().components.filter(({ id }) => ids.includes(id));
  const boards = () => selected().map(({ board }) => board);
  const key = (key: string, shiftKey = false) => fireEvent.keyDown(svg, { key, shiftKey });
  function action(commandId: string, run: () => void, verify: () => void) {
    act(() => {
      useSessionStore.getState().setSelection(selection);
      useViewStore.getState().setContextOpen(true);
    });
    run();
    expect(host.drainJournal().map((entry) => entry.commandId)).toEqual([commandId]);
    verify();
    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
    expect(read().components).toEqual(original.components);
    expect(read().measurements).toEqual(original.measurements);
    host.drainJournal();
  }
  function expectMove(dx: number, dy: number) {
    const expected = original.components.slice(1).map(({ board }) => ({
      x: board!.center.x + dx,
      y: board!.center.y + dy,
    }));
    expect(boards().map((board) => board?.center)).toEqual(expected);
    expect(read().components[0]).toEqual(original.components[0]);
  }

  action(
    'components.rotate',
    () => key('r'),
    () => {
      expect(boards().map((board) => board?.rotationDeg)).toEqual([90, 90, 90]);
      expect(screen.getByText('Omadused · 4 valitud')).toBeTruthy();
      expect(screen.getByText('Mitu objekti on valitud.')).toBeTruthy();
      const pane = screen.getByRole('complementary', { name: 'Omadused' });
      expect(pane.querySelectorAll('section')).toHaveLength(0);
    },
  );
  action(
    'components.rotate',
    () => key('R', true),
    () => {
      expect(boards().map((board) => board?.rotationDeg)).toEqual([270, 270, 270]);
    },
  );
  action(
    'components.flipSide',
    () => key('f'),
    () => {
      expect(boards().map((board) => board?.side)).toEqual(['bottom', 'bottom', 'bottom']);
    },
  );
  action(
    'components.removeFromBoard',
    () => {
      fireEvent.contextMenu(svg, { button: 2, clientX: start.x, clientY: start.y });
      const menu = screen.getByRole('menu', { name: 'Toimingud' });
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Eemalda paigutus plaadilt' }));
    },
    () => {
      expect(boards()).toEqual([undefined, undefined, undefined]);
    },
  );
  action(
    'items.delete',
    () => key('Delete'),
    () => {
      expect(read().components).toEqual([original.components[0]]);
      expect(useSessionStore.getState().selection.items).toEqual(selection.items.slice(-1));
      expect(read().measurements).toEqual(original.measurements);
    },
  );
  action(
    'items.translate',
    () => key('ArrowRight'),
    () => expectMove(1, 0),
  );
  action(
    'items.translate',
    () => {
      pointer(svg, 'pointerdown', start.x, start.y);
      pointer(svg, 'pointermove', start.x + 16, start.y + 12);
      pointer(svg, 'pointerup', start.x + 16, start.y + 12);
    },
    () => expectMove(16, 12),
  );
});
