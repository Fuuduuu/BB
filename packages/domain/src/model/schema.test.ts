import { expect, test } from 'vitest';
import * as domain from '../index';
import type { BoardDoc, Component } from '../index';

function completeDoc(): BoardDoc {
  expect(domain.newBoardDoc).toBeTypeOf('function');
  const doc = domain.newBoardDoc('Katseplaat');
  const component: Component = {
    id: 'cmp_example',
    ref: 'U1',
    kind: 'ic',
    marking: 'A7W',
    value: '',
    identified: false,
    dnp: false,
    note: '',
    referenceImageId: 'att_reference',
    pins: [{ id: '1', uid: 'pin_current', nc: false, name: 'VCC' }],
    board: {
      footprint: 'soic',
      params: { pins: 8, pitch: '1.27' },
      center: { x: 10, y: 20 },
      rotationDeg: 45,
      side: 'top',
      scaleX: 0.2,
      scaleY: 5,
      padMap: { '1': '1' },
      customPads: { '1': { local: { x: 0, y: 0 }, sizeMm: 1, shape: 'circle', through: true } },
      labelOffset: { x: 1, y: 2 },
    },
    schematic: {
      symbol: 'box',
      at: { x: 2, y: 3 },
      rot: 90,
      mirror: false,
      pinMap: { VCC: '1' },
      labelOffset: { x: 0, y: 1 },
    },
  };
  doc.components = [component];
  doc.device = 'Proov';
  doc.problem = 'Ei käivitu';
  doc.status = 'mapped';
  doc.mappedAt = '2026-11-07T10:00:00.000Z';
  doc.mappedSnapshot = {
    componentsIdentified: [0, 1],
    pinsMapped: [1, 1],
    unplaced: { board: 0, schematic: 0 },
    powerDefined: false,
    assumedConnections: 1,
    roleConflicts: 0,
    openImportChecks: 1,
    suspectMeasurements: 0,
  };
  doc.scale = {
    pxPerMm: 10,
    calibrated: true,
    calib: { a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, mm: 1 },
  };
  doc.photos = [
    {
      id: 'pho_example',
      side: 'top',
      name: 'Plaat.jpg',
      widthPx: 4000,
      heightPx: 3000,
      toBoard: [1, 0, 0, 1, -5, 3],
      transform: 'mirror_rot90',
    },
  ];
  doc.activePhotoId = 'pho_example';
  doc.junctions = [
    {
      id: 'jun_example',
      board: { at: { x: 20, y: 20 }, layer: 'top' },
      schematic: { at: { x: 3, y: 3 } },
    },
  ];
  doc.connections = [
    {
      id: 'con_example',
      a: { pin: { c: 'cmp_example', p: '1' } },
      b: { junction: 'jun_example' },
      basis: 'visual',
      board: {
        kind: 'trace',
        layer: 'top',
        waypoints: [{ x: 15, y: 20 }],
        widthMm: 0.2,
        labelOffset: { x: 0, y: 1 },
      },
      schematic: { waypoints: [{ x: 3, y: 2 }] },
    },
  ];
  doc.netLabels = [
    {
      id: 'lbl_example',
      anchor: { junction: 'jun_example' },
      name: 'GND',
      roleId: 'rol_gnd',
      source: 'user',
    },
  ];
  doc.measurements = [
    {
      id: 'msr_old',
      mode: 'continuity',
      at: { c: 'cmp_deleted', p: '8', uid: 'pin_deleted' },
      ref: { c: 'cmp_example', p: '1', uid: 'pin_current' },
      beep: true,
      power: 'off',
      takenAt: '2026-11-07T10:00:00Z',
      atLabel: 'U2.8',
      refLabel: 'U1.1',
      note: 'Enne remonti',
      staleByRepairId: 'rep_example',
      source: 'beep_mode',
    },
  ];
  doc.repairs = [
    {
      id: 'rep_example',
      action: 'trace_fixed',
      text: 'Rada parandatud',
      at: '2026-11-07T10:01:00Z',
      affects: { nets: [{ junction: 'jun_example' }] },
    },
  ];
  doc.areas = [{ id: 'are_example', shape: 'ellipse', x: 0, y: 0, w: 10, h: 5, text: 'Kahjustus' }];
  doc.dimensions = [
    {
      id: 'dim_example',
      a: { pin: { c: 'cmp_example', p: '1' } },
      b: { point: { x: 20, y: 30 } },
      offsetPx: -5,
    },
  ];
  doc.outline = { x: 0, y: 0, w: 100, h: 80, showDims: true };
  doc.textNotes = [
    {
      id: 'txt_example',
      view: 'schematic',
      at: { x: 1, y: 1 },
      text: 'Kontrolli',
      anchor: { component: 'cmp_example' },
    },
  ];
  doc.importChecks = [
    {
      id: 'check_example',
      at: { x: 20, y: 20 },
      layer: 'top',
      junctions: ['jun_example'],
      note: 'Kontrollimata liide',
    },
  ];
  doc.guide.skipped = ['photo'];
  return doc;
}

test('complete document round-trips every described model without dropping data', () => {
  const doc = completeDoc();
  expect(domain.BoardDocSchema.parse(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
});

test('components and connections remain valid without either drawing', () => {
  const doc = completeDoc();
  delete doc.components[0]!.board;
  delete doc.components[0]!.schematic;
  delete doc.connections[0]!.board;
  delete doc.connections[0]!.schematic;
  expect(domain.BoardDocSchema.safeParse(doc).success).toBe(true);
});

test('historical measurement keeps deleted pin UID and saved labels', () => {
  const doc = completeDoc();
  expect(domain.BoardDocSchema.parse(doc).measurements[0]).toMatchObject({
    at: { c: 'cmp_deleted', p: '8', uid: 'pin_deleted' },
    atLabel: 'U2.8',
  });
});

const invalidCases: [string, (doc: BoardDoc) => unknown][] = [
  ['missing pins', (doc) => ({ ...doc, components: [{ ...doc.components[0], pins: undefined }] })],
  [
    'missing pin uid',
    (doc) => ({ ...doc, components: [{ ...doc.components[0], pins: [{ id: '1', nc: false }] }] }),
  ],
  [
    'missing measurement uid',
    (doc) => ({
      ...doc,
      measurements: [{ ...doc.measurements[0], at: { c: 'cmp_deleted', p: '8' } }],
    }),
  ],
  [
    'both endpoint variants',
    (doc) => ({
      ...doc,
      connections: [{ ...doc.connections[0], a: { pin: { c: 'c', p: '1' }, junction: 'j' } }],
    }),
  ],
  [
    'missing endpoint variant',
    (doc) => ({ ...doc, connections: [{ ...doc.connections[0], a: {} }] }),
  ],
  [
    'non-finite coordinates',
    (doc) => ({ ...doc, textNotes: [{ ...doc.textNotes[0], at: { x: Infinity, y: 0 } }] }),
  ],
  [
    'invalid footprint scale',
    (doc) => ({
      ...doc,
      components: [{ ...doc.components[0], board: { ...doc.components[0]!.board, scaleX: 0.1 } }],
    }),
  ],
  [
    'invalid symbol rotation',
    (doc) => ({
      ...doc,
      components: [
        { ...doc.components[0], schematic: { ...doc.components[0]!.schematic, rot: 45 } },
      ],
    }),
  ],
  [
    'wrong photo transform size',
    (doc) => ({ ...doc, photos: [{ ...doc.photos[0], toBoard: [1, 0, 1] }] }),
  ],
  [
    'invalid layer',
    (doc) => ({ ...doc, importChecks: [{ ...doc.importChecks[0], layer: 'wire' }] }),
  ],
  [
    'unknown measurement mode',
    (doc) => ({ ...doc, measurements: [{ ...doc.measurements[0], mode: 'ac' }] }),
  ],
  [
    'invalid timestamp',
    (doc) => ({ ...doc, measurements: [{ ...doc.measurements[0], takenAt: 'yesterday' }] }),
  ],
  ['negative revision', (doc) => ({ ...doc, rev: -1 })],
  [
    'invalid tolerance',
    (doc) => ({ ...doc, measureSettings: { voltageTolerancePct: -1, voltageToleranceMinV: 0.1 } }),
  ],
  ['future format', (doc) => ({ ...doc, format_version: 2 })],
  ['unknown data field', (doc) => ({ ...doc, unsupported: { mustNotDisappear: true } })],
];

test.each(invalidCases)('schema rejects %s', (_name, invalid) => {
  expect(domain.BoardDocSchema.safeParse(invalid(completeDoc())).success).toBe(false);
});

test.each([
  { component: 'cmp_example' },
  { nets: [{ junction: 'jun_example' }] },
  { wholeBoard: true },
  { nothing: true },
])('repair accepts explicit impact %j', (affects) => {
  const doc = completeDoc();
  const repair = { ...doc.repairs[0], affects };
  expect(domain.BoardDocSchema.safeParse({ ...doc, repairs: [repair] }).success).toBe(true);
});

test('OL reading preserves polarity and permits an absent numeric value', () => {
  const doc = completeDoc();
  const measurement = {
    ...doc.measurements[0],
    mode: 'diode',
    overload: true,
    beep: undefined,
    value: undefined,
  };
  expect(domain.BoardDocSchema.safeParse({ ...doc, measurements: [measurement] }).success).toBe(
    true,
  );
});
