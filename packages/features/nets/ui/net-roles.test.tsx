// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import type { EndRef } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { mountMeasurements } from '../../measurements/__tests__/workspace';
import { netlistCsv } from '../contract';

const pin = (p: string): EndRef => ({ pin: { c: 'cmp_u1', p } });

function openNet(name: string) {
  fireEvent.click(screen.getByRole('tab', { name: 'Võrgud' }));
  const pane = within(screen.getByRole('tabpanel', { name: 'Võrgud' }));
  fireEvent.click(pane.getByRole('button', { name }));
  return pane;
}

test('missing_role_shows_in_csv_and_warning', () => {
  const { engine } = mountMeasurements({
    seed(doc) {
      doc.connections.push({ id: 'con_mixed', a: pin('1'), b: pin('2'), basis: 'assumed' });
      doc.netLabels.push(
        { id: 'lbl_mixed', anchor: pin('1'), name: 'Segavõrk', roleId: 'rol_gnd', source: 'user' },
        { id: 'lbl_missing', anchor: pin('2'), roleId: 'rol_missing', source: 'user' },
        {
          id: 'lbl_spare',
          anchor: pin('3'),
          name: 'Varuvõrk',
          roleId: 'rol_missing',
          source: 'user',
        },
      );
    },
  });

  const pane = openNet('Segavõrk · 2 liiget · Rollikonflikt');
  expect
    .soft(pane.getByRole('alert').textContent)
    .toBe('Võimalik lühis või vale ühendus: GND + rol_missing (puudub)');
  expect(netlistCsv(engine.snapshot())).toBe(
    [
      '\uFEFFVõrk;Roll;Tähis.jalg;Jala nimi',
      'Segavõrk;GND + rol_missing (puudub);U1.1;VIN',
      'Segavõrk;GND + rol_missing (puudub);U1.2;',
      'Varuvõrk;rol_missing (puudub);U1.3;',
    ].join('\r\n'),
  );
});

test('selected_role_chip_removes_role', () => {
  const { engine, host, svg } = mountMeasurements({
    seed(doc) {
      doc.connections.push({ id: 'con_ground', a: pin('1'), b: pin('2'), basis: 'assumed' });
      doc.netLabels.push({
        id: 'lbl_ground',
        anchor: pin('1'),
        name: 'Maavõrk',
        roleId: 'rol_gnd',
        source: 'user',
      });
    },
  });

  const pane = openNet('Maavõrk · 2 liiget · GND');
  const chip = () => pane.getByRole('button', { name: 'GND' });
  expect(chip().getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(chip());
  expect.soft(chip().getAttribute('aria-pressed')).toBe('false');
  expect
    .soft(engine.snapshot().doc.netLabels)
    .toEqual([{ id: 'lbl_ground', anchor: pin('1'), name: 'Maavõrk', source: 'user' }]);
  expect.soft(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['nets.assign']);

  fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
  expect(chip().getAttribute('aria-pressed')).toBe('true');
  expect(engine.snapshot().doc.netLabels[0]?.roleId).toBe('rol_gnd');
});
