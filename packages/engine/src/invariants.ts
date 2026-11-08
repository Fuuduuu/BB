import { BoardDocSchema } from '@pcbk/domain';
import type { BoardDoc, IdPrefix } from '@pcbk/domain';
import { ZodError } from 'zod';
import type { ZodIssue } from 'zod';

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

export function validateDocument(input: unknown): BoardDoc {
  const doc = BoardDocSchema.parse(input);
  const issues: ZodIssue[] = [];
  const ids = new Set<string>();
  const add = (path: PropertyKey[], message: string) => {
    issues.push({ code: 'custom', path, message });
  };
  const prefix = (id: string, expected: string) =>
    id.startsWith(`${expected}_`) && id.length > expected.length + 1;
  for (const [key, expected] of Object.entries(collections)) {
    const name = key as keyof typeof collections;
    doc[name].forEach((item, index) => {
      const path = [name, index, 'id'];
      if (!prefix(item.id, expected)) add(path, 'invalid_id_prefix');
      if (ids.has(item.id)) add(path, 'duplicate_id');
      ids.add(item.id);
    });
  }
  const refs = new Set<string>();
  const uids = new Set<string>();
  doc.components.forEach((component, index) => {
    const ref = component.ref.trim().toUpperCase();
    if (!ref || refs.has(ref)) add(['components', index, 'ref'], 'invalid_or_duplicate_ref');
    refs.add(ref);
    const pins = new Set<string>();
    component.pins.forEach((pin, pinIndex) => {
      const path = ['components', index, 'pins', pinIndex];
      if (pins.has(pin.id)) add([...path, 'id'], 'duplicate_pin_id');
      if (uids.has(pin.uid)) add([...path, 'uid'], 'duplicate_pin_uid');
      if (!prefix(pin.uid, 'pin')) add([...path, 'uid'], 'invalid_pin_uid_prefix');
      pins.add(pin.id);
      uids.add(pin.uid);
    });
  });
  doc.measurements.forEach((measurement, index) => {
    if (measurement.overload === true && measurement.value !== undefined)
      add(['measurements', index, 'value'], 'overload_excludes_value');
    if (measurement.beep !== undefined && measurement.mode !== 'continuity')
      add(['measurements', index, 'beep'], 'beep_requires_continuity');
  });
  if (issues.length) throw new ZodError(issues);
  return doc;
}
