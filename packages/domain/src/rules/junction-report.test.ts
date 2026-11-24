import { expect, test } from 'vitest';
import { newBoardDoc } from '../doc';
import type { Connection } from '../model/connection';
import { isEmptyReport } from './connections';
import { deleteItems } from './items';

function connection(id: string, a: string, b: string): Connection {
  return { id, a: { junction: a }, b: { junction: b }, basis: 'assumed' };
}

function junctionBoard() {
  const doc = newBoardDoc('Liitepunktide kustutamise katse');
  doc.junctions.push({ id: 'jun_a' }, { id: 'jun_b' }, { id: 'jun_c' }, { id: 'jun_d' });
  doc.connections.push(
    connection('con_ab', 'jun_a', 'jun_b'),
    connection('con_ac', 'jun_a', 'jun_c'),
    connection('con_bd', 'jun_b', 'jun_d'),
  );
  return doc;
}

test('junction_delete_reports_removed_connections', () => {
  const doc = junctionBoard();
  const report = deleteItems(doc, ['jun_a', 'jun_b']);
  expect.soft(report).toEqual({ removedLabels: [], removedConnections: 3 });
  expect.soft(isEmptyReport(report)).toBe(false);
  expect(doc.connections).toEqual([]);

  const mixed = junctionBoard();
  expect.soft(deleteItems(mixed, ['jun_a', 'jun_b', 'con_ab'])).toEqual({
    removedLabels: [],
    removedConnections: 2,
  });
  expect(mixed.connections).toEqual([]);

  const direct = junctionBoard();
  const directReport = deleteItems(direct, ['con_ab']);
  expect(directReport).toEqual({ removedLabels: [] });
  expect(isEmptyReport(directReport)).toBe(true);
  expect(direct.connections.map(({ id }) => id)).toEqual(['con_ac', 'con_bd']);
});
