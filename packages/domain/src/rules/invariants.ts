import type { IdPrefix } from '../ids';
import type { BoardDoc, DocKey } from '../model/board';

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

export const INVARIANTS: readonly Invariant[] = [
  { id: 'ids', inputs: entityFields, check: checkIds },
  { id: 'components', inputs: ['components'], check: checkComponents },
  { id: 'measurements', inputs: ['measurements'], check: checkMeasurements },
];
