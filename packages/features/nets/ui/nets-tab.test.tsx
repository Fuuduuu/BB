// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import type { BoardDoc, EndRef } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import { useSessionStore } from '@pcbk/ui';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { mountMeasurements, pinRef } from '../../measurements/__tests__/workspace';

const pin = (p: string): EndRef => ({ pin: { c: 'cmp_u1', p } });

const dialogMethods = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
};

beforeEach(() => {
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
  for (const method of ['showModal', 'close'] as const) {
    if (dialogMethods[method]) {
      Object.defineProperty(HTMLDialogElement.prototype, method, dialogMethods[method]);
    } else {
      delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>)[method];
    }
  }
});

function seedTwoNets(doc: BoardDoc) {
  doc.connections.push(
    { id: 'con_a', a: pin('1'), b: pin('2'), basis: 'assumed' },
    { id: 'con_b', a: pin('3'), b: pin('4'), basis: 'assumed' },
  );
}

function openNets() {
  fireEvent.click(screen.getByRole('tab', { name: 'Võrgud' }));
  return within(screen.getByRole('tabpanel', { name: 'Võrgud' }));
}

function undo(svg: SVGSVGElement) {
  fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
}

test('nets_tab_assigns_role_and_name', () => {
  const { engine, host, svg } = mountMeasurements({
    seed(doc) {
      seedTwoNets(doc);
      doc.netLabels.push({ id: 'lbl_vcc', anchor: pin('3'), name: 'VCC', source: 'user' });
    },
  });
  const pane = openNets();
  expect(pane.getByText('VCC')).toBeTruthy();
  const unnamed = pane.getByText('N1');
  expect(unnamed.tagName).toBe('EM');
  fireEvent.click(pane.getByRole('button', { name: /^N1(?:\s|$)/u }));

  fireEvent.click(pane.getByRole('button', { name: 'GND' }));
  expect(engine.snapshot().doc.netLabels).toContainEqual(
    expect.objectContaining({ anchor: pin('1'), roleId: 'rol_gnd' }),
  );
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['nets.assign']);
  undo(svg);
  expect(engine.snapshot().doc.netLabels).toHaveLength(1);
  expect(host.drainJournal().map(({ kind }) => kind)).toEqual(['undo']);

  const field = pane.getByRole<HTMLInputElement>('textbox', { name: 'Nimi' });
  fireEvent.change(field, { target: { value: 'DATA' } });
  fireEvent.keyDown(field, { key: 'Enter' });
  expect(engine.snapshot().doc.netLabels).toContainEqual(
    expect.objectContaining({ anchor: pin('1'), name: 'DATA' }),
  );
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['nets.assign']);
  fireEvent.change(field, { target: { value: 'Katkestatud' } });
  fireEvent.keyDown(field, { key: 'Escape' });
  expect(field.value).toBe('DATA');
  expect(host.drainJournal()).toEqual([]);
  undo(svg);
  expect(engine.snapshot().doc.netLabels).toHaveLength(1);
  expect(host.drainJournal().map(({ kind }) => kind)).toEqual(['undo']);

  fireEvent.click(pane.getByRole('button', { name: '+ Uus roll' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Uus roll' }));
  fireEvent.change(dialog.getByRole('textbox', { name: 'Nimi' }), {
    target: { value: 'Andmesiin' },
  });
  fireEvent.change(dialog.getByRole('combobox', { name: 'Liik' }), {
    target: { value: 'signal' },
  });
  fireEvent.change(dialog.getByRole('textbox', { name: 'Nimipinge (V)' }), {
    target: { value: '1,25' },
  });
  fireEvent.change(dialog.getByLabelText('Värv'), { target: { value: '#226644' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Lisa' }));
  expect(pane.getByRole('button', { name: 'Andmesiin' })).toBeTruthy();
  expect(engine.snapshot().doc.roles).toContainEqual(
    expect.objectContaining({
      label: 'Andmesiin',
      kind: 'signal',
      nominalV: 1.25,
      color: '#226644',
    }),
  );
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['roles.add']);
  undo(svg);
  expect(pane.queryByRole('button', { name: 'Andmesiin' })).toBeNull();
  expect(host.drainJournal().map(({ kind }) => kind)).toEqual(['undo']);
});

test('role_conflict_warning_shows_both_roles', () => {
  const { engine, svg } = mountMeasurements({
    seed(doc) {
      doc.roles.push({ id: 'rol_power', label: '5V', kind: 'power', color: '#d9342b' });
      doc.connections.push(
        {
          id: 'con_trace',
          a: pin('1'),
          b: pin('2'),
          basis: 'visual',
          board: { kind: 'trace', layer: 'top', widthMm: 0.3, waypoints: [] },
        },
        { id: 'con_air', a: pin('2'), b: pin('3'), basis: 'assumed' },
      );
      doc.netLabels.push(
        { id: 'lbl_gnd', anchor: pin('1'), name: 'Segavõrk', roleId: 'rol_gnd', source: 'user' },
        { id: 'lbl_power', anchor: pin('3'), roleId: 'rol_power', source: 'user' },
      );
    },
  });
  const pane = openNets();
  fireEvent.click(pane.getByRole('button', { name: /^Segavõrk(?:\s|$)/u }));
  const warning = 'Võimalik lühis või vale ühendus: GND + 5V';
  expect(pane.getByText(warning)).toBeTruthy();
  const halos = '[data-layer="connections.traces"] [stroke="var(--danger)"]';
  expect(svg.querySelector(halos)).toBeTruthy();

  fireEvent.click(pane.getByRole('button', { name: 'Näita ühendust' }));
  expect(useSessionStore.getState().selection.items).toEqual([
    { kind: 'connection', id: 'con_trace' },
    { kind: 'connection', id: 'con_air' },
  ]);
  fireEvent.click(pane.getByRole('button', { name: 'Vali õige roll' }));
  fireEvent.click(pane.getByRole('button', { name: 'GND' }));
  expect(engine.snapshot().derived.nets?.list[0]).toMatchObject({
    roleId: 'rol_gnd',
    roleConflict: false,
  });
  expect(pane.queryByText(warning)).toBeNull();
  expect(svg.querySelector(halos)).toBeNull();
});

test('net_view_pin_click_focuses_pin_including_point_parts', () => {
  const { engine, svg } = mountMeasurements({
    seed(doc) {
      const source = doc.components[0]!;
      source.ref = 'R1';
      source.kind = 'resistor';
      source.pins[0]!.name = 'GND';
      const start = boardPads(
        source.board!,
        source.pins.map(({ id }) => id),
        10,
      )[0]!.at;
      const endpoint = { c: 'cmp_tp1', p: '1', uid: 'pin_tp1_1' };
      doc.components.push({
        ...source,
        id: endpoint.c,
        ref: 'TP1',
        kind: 'testpoint',
        pins: [{ id: endpoint.p, uid: endpoint.uid, nc: false }],
        board: {
          ...source.board!,
          footprint: 'point',
          params: { type: 'tp' },
          center: { x: start.x + 125, y: start.y },
        },
      });
      doc.connections.push(
        {
          id: 'con_ground',
          a: pin('1'),
          b: { pin: { c: endpoint.c, p: endpoint.p } },
          basis: 'visual',
          board: { kind: 'trace', layer: 'top', widthMm: 0.3, waypoints: [] },
        },
        { id: 'con_other', a: pin('3'), b: pin('4'), basis: 'assumed' },
      );
      doc.netLabels.push({ id: 'lbl_ground', anchor: pin('1'), name: 'Maandus', source: 'user' });
      doc.measurements.push({
        id: 'msr_voltage',
        mode: 'voltage',
        at: pinRef('1'),
        atLabel: 'R1.GND',
        ref: endpoint,
        refLabel: 'TP1.1',
        value: 4.98,
        power: 'on',
        takenAt: '2026-11-20T10:00:00Z',
        source: 'manual',
      });
    },
  });
  const pane = openNets();
  fireEvent.click(pane.getByRole('button', { name: /^Maandus(?:\s|$)/u }));
  expect(pane.getByRole('button', { name: 'R1.GND' })).toBeTruthy();
  expect(pane.getByText('Rajad kokku 12,50 mm')).toBeTruthy();
  expect(pane.getByText('4,98 V Pinge · R1.GND → TP1.1')).toBeTruthy();
  fireEvent.click(pane.getByRole('button', { name: 'TP1.1' }));
  expect(useSessionStore.getState().selection.items).toEqual([
    { kind: 'pin', id: '1', componentId: 'cmp_tp1' },
  ]);

  fireEvent.click(screen.getByRole('tab', { name: 'Komponendid' }));
  const point = screen.getByRole('button', { name: 'Vali TP1' });
  fireEvent.pointerEnter(point);
  const outline = svg.querySelector('[data-layer="components.hover"] polygon')!;
  const xs = outline
    .getAttribute('points')!
    .split(' ')
    .map((pair) => Number(pair.split(',')[0]));
  const center = engine.snapshot().doc.components.find(({ id }) => id === 'cmp_tp1')!.board!.center;
  expect(Math.min(...xs)).toBeCloseTo(center.x - 10.5);
  expect(Math.max(...xs)).toBeCloseTo(center.x + 10.5);
  fireEvent.pointerLeave(point);

  const reopened = openNets();
  const ground = reopened.queryByRole('button', { name: /^Maandus(?:\s|$)/u });
  if (ground) fireEvent.click(ground);
  fireEvent.click(reopened.getByRole('button', { name: 'Ühenda võrguga…' }));
  const join = within(screen.getByRole('dialog', { name: 'Ühenda võrguga…' }));
  fireEvent.click(join.getByRole('button', { name: /^N1(?:\s|$)/u }));
  expect(engine.snapshot().derived.nets?.list).toHaveLength(1);
  expect(engine.snapshot().doc.connections.at(-1)).toMatchObject({ basis: 'assumed' });
});
