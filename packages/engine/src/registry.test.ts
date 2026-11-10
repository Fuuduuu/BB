import { BoardDocSchema, newBoardDoc } from '@pcbk/domain';
import type { DocKey } from '@pcbk/domain';
import { expect, test } from 'vitest';
import { z } from 'zod';
import { buildRegistry, createEngine, RegistryError } from './index';
import type { EngineModule } from './index';
import { clock } from './__tests__/helpers';

const fields = BoardDocSchema.keyof().options.filter(
  (key) => key !== 'rev' && key !== 'format_version',
);
const owner = (owns: DocKey[] = fields): EngineModule => ({ id: 'owner', owns });
const command = {
  id: 'test.mutate' as const,
  title: 'Mutate',
  params: z.strictObject({}),
  run() {},
};

test('registry accepts exactly one owner or reservation for every document field', () => {
  expect(() =>
    buildRegistry([owner(fields.filter((key) => key !== 'device'))], ['device']),
  ).not.toThrow();
});
test('registry rejects a field with two owners', () => {
  expect(() => buildRegistry([owner(), { id: 'other', owns: ['components'] }])).toThrow(
    RegistryError,
  );
});
test('registry rejects an unowned optional field', () => {
  expect(() => buildRegistry([owner(fields.filter((key) => key !== 'mappedAt'))])).toThrow(
    RegistryError,
  );
});
test('registry rejects a field that is both owned and reserved', () => {
  expect(() => buildRegistry([owner()], ['name'])).toThrow(RegistryError);
});
test('registry rejects repeated ownership within one module', () => {
  expect(() => buildRegistry([owner([...fields, 'name'])])).toThrow(RegistryError);
});
test.each(['rev', 'format_version'] as const)('registry keeps %s in the core', (field) => {
  expect(() => buildRegistry([owner([...fields, field])])).toThrow(RegistryError);
  expect(() => buildRegistry([owner()], [field])).toThrow(RegistryError);
});
test.each(['unknown', 'toString', '__proto__'])('registry rejects unknown field %s', (field) => {
  expect(() => buildRegistry([owner([...fields, field as DocKey])])).toThrow(RegistryError);
  expect(() => buildRegistry([owner()], [field as DocKey])).toThrow(RegistryError);
  expect(() =>
    buildRegistry([
      owner(),
      { id: 'writer', commands: [{ ...command, alsoWrites: [field as DocKey] }] },
    ]),
  ).toThrow(RegistryError);
});
test('registry rejects duplicate reservations', () => {
  expect(() =>
    buildRegistry([owner(fields.filter((key) => key !== 'device'))], ['device', 'device']),
  ).toThrow(RegistryError);
});
test('registry rejects duplicate module and command ids', () => {
  expect(() => buildRegistry([owner(), { id: 'owner' }])).toThrow(RegistryError);
  expect(() =>
    buildRegistry([
      { ...owner(), commands: [command] },
      { id: 'other', commands: [command] },
    ]),
  ).toThrow(RegistryError);
});
test('registry rejects a missing module dependency', () => {
  expect(() => buildRegistry([{ ...owner(), dependsOn: ['missing'] }])).toThrow(RegistryError);
});
test.each([
  [{ id: 'a', dependsOn: ['a'] }],
  [
    { id: 'a', dependsOn: ['b'] },
    { id: 'b', dependsOn: ['a'] },
  ],
  [
    { id: 'a', dependsOn: ['b'] },
    { id: 'b', dependsOn: ['c'] },
    { id: 'c', dependsOn: ['a'] },
  ],
])('registry rejects dependency cycles %#', (...modules) => {
  expect(() => buildRegistry([owner(), ...modules])).toThrow(RegistryError);
});
test('dependent derivations see the dependency result regardless of registration order', () => {
  const { engine, host } = createEngine({
    clock,
    modules: [
      {
        ...owner(),
        dependsOn: ['provider'],
        derive: [
          {
            key: 'unplacedSchematic',
            inputs: [],
            schema: z.array(z.string()),
            initial: [],
            run: (_doc, derived) => [...derived.unplacedBoard],
          },
        ],
      },
      {
        id: 'provider',
        derive: [
          {
            key: 'unplacedBoard',
            inputs: [],
            schema: z.array(z.string()),
            initial: [],
            run: () => ['cmp_dependency'],
          },
        ],
      },
    ],
  });
  host.load('registry', newBoardDoc('Plaat'), false);
  expect(engine.snapshot().derived.unplacedSchematic).toEqual(['cmp_dependency']);
});
