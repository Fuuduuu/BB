import { BoardDocSchema } from '@pcbk/domain';
import type { BoardDoc } from '@pcbk/domain';
import { INVARIANTS } from '@pcbk/domain/rules';
import { ZodError } from 'zod';

export function validateDocument(input: unknown): BoardDoc {
  const doc = BoardDocSchema.parse(input);
  const issues = INVARIANTS.flatMap(({ check }) => check(doc));
  if (issues.length) {
    throw new ZodError(issues.map(({ path, code }) => ({ code: 'custom', path, message: code })));
  }
  return doc;
}
