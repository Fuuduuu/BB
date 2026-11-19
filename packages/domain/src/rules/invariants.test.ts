import { INVARIANTS } from '@pcbk/domain/rules';
import { expect, test } from 'vitest';
import { ZodError } from 'zod';
import { createEngine } from '../../../engine/src/engine';
import { validateDocument } from '../../../engine/src/invariants';
import { engineFeatures, RESERVED_FIELDS } from '../../../features/engine';
import { newBoardDoc } from '../doc';
import type { BoardDoc } from '../model/board';

function invalidDocument(): BoardDoc {
  const board = newBoardDoc('Invalid invariant fixture');
  board.components.push(
    {
      id: 'cmp_first',
      ref: 'R1',
      kind: 'resistor',
      marking: '',
      value: '',
      identified: false,
      dnp: false,
      note: '',
      pins: [{ id: '1', uid: 'missing-prefix', nc: false }],
    },
    {
      id: 'wrong_second',
      ref: ' r1 ',
      kind: 'resistor',
      marking: '',
      value: '',
      identified: false,
      dnp: false,
      note: '',
      pins: [],
    },
  );
  board.measurements.push({
    id: 'msr_first',
    at: { c: 'cmp_first', p: '1', uid: 'missing-prefix' },
    atLabel: 'R1.1',
    mode: 'voltage',
    power: 'on',
    takenAt: '2026-01-01T00:00:00.000Z',
    source: 'manual',
    overload: true,
    value: 3.3,
  });
  return board;
}

function validationIssues(doc: BoardDoc) {
  try {
    validateDocument(doc);
  } catch (error) {
    if (error instanceof ZodError) return error.issues;
    throw error;
  }
  throw new Error('The invalid fixture passed engine validation');
}

test('invariants_come_from_domain_list', () => {
  const doc = invalidDocument();
  const issues = validationIssues(doc);
  expect(issues).toEqual([
    { code: 'custom', path: ['components', 1, 'id'], message: 'invalid_id_prefix' },
    {
      code: 'custom',
      path: ['components', 0, 'pins', 0, 'uid'],
      message: 'invalid_pin_uid_prefix',
    },
    { code: 'custom', path: ['components', 1, 'ref'], message: 'invalid_or_duplicate_ref' },
    { code: 'custom', path: ['measurements', 0, 'value'], message: 'overload_excludes_value' },
  ]);
  expect(INVARIANTS.map(({ id, inputs }) => ({ id, inputs }))).toEqual([
    {
      id: 'ids',
      inputs: [
        'components',
        'junctions',
        'connections',
        'netLabels',
        'roles',
        'measurements',
        'repairs',
        'photos',
        'dimensions',
        'areas',
        'textNotes',
        'importChecks',
      ],
    },
    { id: 'components', inputs: ['components'] },
    { id: 'measurements', inputs: ['measurements'] },
    { id: 'connections', inputs: ['connections', 'components', 'junctions'] },
    { id: 'junctions', inputs: ['junctions', 'connections'] },
    { id: 'netLabels', inputs: ['netLabels', 'components', 'junctions'] },
  ]);
  const ruleIssues = INVARIANTS.flatMap((rule) => {
    const issues = rule.check(doc);
    for (const issue of issues) expect(rule.inputs, rule.id).toContain(issue.path[0]);
    return issues;
  });
  expect(ruleIssues).toEqual(issues.map(({ path, message }) => ({ path, code: message })));
});

test('invariants_reject_dangling_end_and_label_anchor', () => {
  const doc = newBoardDoc('Vigaste otste proov');
  const live = { junction: 'jun_live' };
  const missing = { pin: { c: 'cmp_missing', p: '4' } };
  doc.junctions.push({ id: live.junction }, { id: 'jun_isolated' });
  doc.connections.push(
    { id: 'con_dangling_a', a: missing, b: live, basis: 'assumed' },
    { id: 'con_same', a: live, b: live, basis: 'assumed' },
    { id: 'con_dangling_b', a: live, b: { junction: 'jun_missing' }, basis: 'assumed' },
  );
  doc.netLabels.push({ id: 'lbl_missing', anchor: missing, source: 'user' });

  expect(() => validateDocument(doc)).toThrow(ZodError);
  const issues = validationIssues(doc);
  expect(issues).toEqual([
    { code: 'custom', path: ['connections', 0, 'a'], message: 'dangling_connection_end' },
    { code: 'custom', path: ['connections', 1, 'b'], message: 'connection_ends_equal' },
    { code: 'custom', path: ['connections', 2, 'b'], message: 'dangling_connection_end' },
    { code: 'custom', path: ['junctions', 1, 'id'], message: 'orphan_junction' },
    { code: 'custom', path: ['netLabels', 0, 'anchor'], message: 'dangling_label_anchor' },
  ]);
  const registered = INVARIANTS.flatMap(({ check, inputs }) =>
    check(doc).map((issue) => {
      expect(inputs).toContain(issue.path[0]);
      return issue;
    }),
  );
  expect(registered).toEqual(issues.map(({ path, message }) => ({ path, code: message })));

  const board = newBoardDoc('Ühenduse käsu proov');
  board.components.push({
    ...invalidDocument().components[0]!,
    pins: [{ id: '1', uid: 'pin_valid_1', nc: false }],
  });
  const { engine, host } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => '2026-01-01T00:00:00.000Z' },
  });
  host.load('connections', board, false);
  const end = { pin: { c: 'cmp_first', p: '1' } };
  const before = engine.snapshot();
  const connect = (other: typeof end) =>
    engine.execute('connections.add', {
      items: [{ id: 'con_new', a: end, b: other }],
      basis: 'assumed',
      skipJoined: true,
    });
  expect(connect(missing)).toEqual({
    ok: false,
    error: { code: 'not_found', id: 'cmp_missing:4' },
  });
  expect(connect(end)).toEqual({
    ok: false,
    error: {
      code: 'validation',
      issues: [{ code: 'custom', path: [], message: 'connection_ends_equal' }],
    },
  });
  expect(engine.snapshot()).toBe(before);
});
