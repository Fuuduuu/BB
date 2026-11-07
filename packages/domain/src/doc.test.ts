import { expect, test } from 'vitest';
import * as domain from './index';

test('new document is valid and starts with honest empty data', () => {
  expect(domain.newBoardDoc).toBeTypeOf('function');
  const doc = domain.newBoardDoc('Plaat õäöü (2)');
  expect(domain.BoardDocSchema.safeParse(doc).success).toBe(true);
  expect(doc).toMatchObject({
    name: 'Plaat õäöü (2)',
    format_version: 1,
    rev: 0,
    status: 'mapping',
    scale: { pxPerMm: 10, calibrated: false },
    measureSettings: { voltageTolerancePct: 10, voltageToleranceMinV: 0.1 },
    guide: { skipped: [] },
  });
  for (const name of [
    'photos',
    'components',
    'junctions',
    'connections',
    'netLabels',
    'measurements',
    'repairs',
    'areas',
    'dimensions',
    'textNotes',
    'importChecks',
  ] as const) {
    expect(doc[name]).toEqual([]);
  }
  expect(
    doc.roles.map(({ id, label, kind, nominalV, color }) => [id, label, kind, nominalV, color]),
  ).toEqual([
    ['rol_gnd', 'GND', 'ground', 0, '#1f2523'],
    ['rol_3v3', '3V3', 'power', 3.3, '#e8891c'],
    ['rol_5v', '5V', 'power', 5, '#d9342b'],
    ['rol_12v', '12V', 'power', 12, '#2a64d6'],
    ['rol_sig', 'Signaal', 'signal', undefined, '#8a4fd3'],
    ['rol_unk', 'Teadmata', 'unknown', undefined, '#8c9692'],
  ]);
});

test('new documents do not share mutable defaults', () => {
  expect(domain.newBoardDoc).toBeTypeOf('function');
  const first = domain.newBoardDoc('Esimene');
  const second = domain.newBoardDoc('Teine');
  first.roles[0]!.label = 'Muudetud';
  first.guide.skipped.push('photo');
  first.scale.pxPerMm = 20;
  first.measureSettings.voltageTolerancePct = 5;
  expect(second.roles[0]!.label).toBe('GND');
  expect(second.guide.skipped).toEqual([]);
  expect(second.scale.pxPerMm).toBe(10);
  expect(second.measureSettings.voltageTolerancePct).toBe(10);
  expect(domain.newBoardDoc('Kolmas').roles[0]!.label).toBe('GND');
});
