import { BoardDocSchema, newBoardDoc } from '@pcbk/domain';
import type { BoardDoc, Component, DocKey } from '@pcbk/domain';
import type { Draft } from 'immer';
import { expect } from 'vitest';
import { z } from 'zod';
import * as api from '../index';
import type { Clock, EngineModule } from '../index';

declare module '@pcbk/contracts' {
  interface CommandMap {
    'demo.rename': { name: string };
    'test.mutate': Record<string, never>;
    'evil.touch': Record<string, never>;
  }
}
export const clock: Clock = { now: () => '2026-11-08T10:00:00.000Z' };
export const demo: EngineModule = {
  id: 'demo',
  owns: ['name'],
  commands: [
    {
      id: 'demo.rename',
      title: 'Rename',
      params: z.strictObject({ name: z.string().min(1) }),
      run(doc, params) {
        doc.name = params.name;
      },
      summary(params) {
        return `Rename: ${params.name}`;
      },
    },
  ],
};
export function component(id = 'cmp_a', ref = 'R1'): Component {
  return {
    id,
    ref,
    kind: 'resistor',
    marking: '',
    value: '',
    identified: false,
    dnp: false,
    note: '',
    pins: [
      { id: '1', uid: `pin_${id}_1`, nc: false },
      { id: '2', uid: `pin_${id}_2`, nc: false },
    ],
  };
}
export function mutationModule(run: (doc: Draft<BoardDoc>) => void, owns?: DocKey[]): EngineModule {
  return {
    id: 'test',
    owns:
      owns ??
      BoardDocSchema.keyof().options.filter((key) => key !== 'rev' && key !== 'format_version'),
    commands: [{ id: 'test.mutate', title: 'Mutate', params: z.strictObject({}), run }],
  };
}
export function setup(
  options: {
    modules?: EngineModule[];
    doc?: BoardDoc;
    readOnly?: boolean;
    reserved?: DocKey[];
    clock?: Clock;
  } = {},
) {
  expect(api.createEngine).toBeTypeOf('function');
  const result = api.createEngine({
    modules: options.modules ?? [demo],
    clock: options.clock ?? clock,
    reserved: options.reserved,
  });
  result.host.load('session-a', options.doc ?? newBoardDoc('Plaat'), options.readOnly ?? false);
  return result;
}
