import type { IdPrefix } from '../ids';
import type { BoardDoc, DocKey } from '../model/board';
import { connectedJunctionIds } from './connections';
import { endKey, endRefsByKey } from './nets';

export interface Issue {
  path: (string | number)[];
  code: string;
}

export interface Invariant {
  id: string;
  inputs: readonly DocKey[];
  check(doc: BoardDoc): Issue[];
}

type EntityField = {
  [K in keyof BoardDoc]-?: NonNullable<BoardDoc[K]> extends { id: string }[] ? K : never;
}[keyof BoardDoc];

const collections = {
  components: 'cmp',
  junctions: 'jun',
  connections: 'con',
  netLabels: 'lbl',
  roles: 'rol',
  measurements: 'msr',
  repairs: 'rep',
  photos: 'pho',
  dimensions: 'dim',
  areas: 'are',
  textNotes: 'txt',
  importChecks: 'chk',
} as const satisfies Record<EntityField, IdPrefix>;

const entityFields = Object.keys(collections) as EntityField[];

function hasPrefix(id: string, expected: IdPrefix): boolean {
  return id.startsWith(`${expected}_`) && id.length > expected.length + 1;
}

function checkIds(doc: BoardDoc): Issue[] {
  const issues: Issue[] = [];
  const ids = new Set<string>();
  for (const field of entityFields) {
    const expected = collections[field];
    doc[field].forEach(({ id }, index) => {
      const path = [field, index, 'id'];
      if (!hasPrefix(id, expected)) issues.push({ path, code: 'invalid_id_prefix' });
      if (ids.has(id)) issues.push({ path, code: 'duplicate_id' });
      ids.add(id);
    });
  }
  return issues;
}

function checkComponents(doc: BoardDoc): Issue[] {
  const issues: Issue[] = [];
  const refs = new Set<string>();
  const uids = new Set<string>();
  doc.components.forEach((component, index) => {
    const ref = component.ref.trim().toUpperCase();
    if (!ref || refs.has(ref))
      issues.push({ path: ['components', index, 'ref'], code: 'invalid_or_duplicate_ref' });
    refs.add(ref);
    const pins = new Set<string>();
    component.pins.forEach((pin, pinIndex) => {
      const path = ['components', index, 'pins', pinIndex];
      if (pins.has(pin.id)) issues.push({ path: [...path, 'id'], code: 'duplicate_pin_id' });
      if (uids.has(pin.uid)) issues.push({ path: [...path, 'uid'], code: 'duplicate_pin_uid' });
      if (!hasPrefix(pin.uid, 'pin'))
        issues.push({ path: [...path, 'uid'], code: 'invalid_pin_uid_prefix' });
      pins.add(pin.id);
      uids.add(pin.uid);
    });
  });
  return issues;
}

function checkMeasurements(doc: BoardDoc): Issue[] {
  const issues: Issue[] = [];
  doc.measurements.forEach((measurement, index) => {
    if (measurement.overload === true && measurement.value !== undefined)
      issues.push({ path: ['measurements', index, 'value'], code: 'overload_excludes_value' });
    if (measurement.beep !== undefined && measurement.mode !== 'continuity')
      issues.push({ path: ['measurements', index, 'beep'], code: 'beep_requires_continuity' });
  });
  return issues;
}

function checkConnections(doc: BoardDoc): Issue[] {
  if (doc.connections.length === 0) return [];
  const issues: Issue[] = [];
  const known = endRefsByKey(doc);
  doc.connections.forEach(({ a, b }, index) => {
    const left = endKey(a);
    const right = endKey(b);
    if (!known.has(left))
      issues.push({ path: ['connections', index, 'a'], code: 'dangling_connection_end' });
    if (!known.has(right))
      issues.push({ path: ['connections', index, 'b'], code: 'dangling_connection_end' });
    if (left === right)
      issues.push({ path: ['connections', index, 'b'], code: 'connection_ends_equal' });
  });
  return issues;
}

function checkJunctions(doc: BoardDoc): Issue[] {
  if (doc.junctions.length === 0) return [];
  const connected = connectedJunctionIds(doc.connections);
  return doc.junctions.flatMap(({ id }, index) =>
    connected.has(id) ? [] : [{ path: ['junctions', index, 'id'], code: 'orphan_junction' }],
  );
}

function checkNetLabels(doc: BoardDoc): Issue[] {
  if (doc.netLabels.length === 0) return [];
  const known = endRefsByKey(doc);
  return doc.netLabels.flatMap(({ anchor }, index) =>
    known.has(endKey(anchor))
      ? []
      : [{ path: ['netLabels', index, 'anchor'], code: 'dangling_label_anchor' }],
  );
}

export const INVARIANTS: readonly Invariant[] = [
  { id: 'ids', inputs: entityFields, check: checkIds },
  { id: 'components', inputs: ['components'], check: checkComponents },
  { id: 'measurements', inputs: ['measurements'], check: checkMeasurements },
  {
    id: 'connections',
    inputs: ['connections', 'components', 'junctions'],
    check: checkConnections,
  },
  { id: 'junctions', inputs: ['junctions', 'connections'], check: checkJunctions },
  { id: 'netLabels', inputs: ['netLabels', 'components', 'junctions'], check: checkNetLabels },
];
