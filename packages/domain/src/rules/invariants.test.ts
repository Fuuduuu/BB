import { INVARIANTS } from '@pcbk/domain/rules';
import { expect, test } from 'vitest';
import { ZodError } from 'zod';
import { validateDocument } from '../../../engine/src/invariants';
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
  ]);
  const ruleIssues = INVARIANTS.flatMap((rule) => {
    const issues = rule.check(doc);
    for (const issue of issues) expect(rule.inputs, rule.id).toContain(issue.path[0]);
    return issues;
  });
  expect(ruleIssues).toEqual(issues.map(({ path, message }) => ({ path, code: message })));
});
