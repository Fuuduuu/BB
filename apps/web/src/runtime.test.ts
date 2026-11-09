import { RegistryError } from '@pcbk/engine';
import { expect, test, vi } from 'vitest';
import { createRuntime } from './runtime';

vi.mock('@pcbk/domain', async (importOriginal) => {
  const domain = await importOriginal<typeof import('@pcbk/domain')>();
  return {
    ...domain,
    BoardDocSchema: domain.BoardDocSchema.extend({
      unownedTestField: domain.BoardDocSchema.shape.device,
    }),
  };
});

test('unowned unreserved BoardDoc field fails startup', () => {
  expect(createRuntime).toThrow(RegistryError);
  expect(createRuntime).toThrow(/unownedTestField/u);
});
