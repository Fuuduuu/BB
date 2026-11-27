import { newBoardDoc } from '@pcbk/domain';
import type { BoardDoc, DocKey } from '@pcbk/domain';
import { createEngine } from '@pcbk/engine';
import { expect } from 'vitest';
import { engineFeatures, RESERVED_FIELDS } from '../engine';
import * as project from '../project/engine/index';
import * as components from '../components/engine/index';
import { connectionsEngine } from '../connections/engine';
import { netsEngine } from '../nets/engine';
import * as photo from '../photo/engine/index';

const reserved: DocKey[] = [
  'measurements',
  'measureSettings',
  'repairs',
  'areas',
  'dimensions',
  'outline',
  'textNotes',
  'guide',
];
export function idGenerator() {
  let next = 0;
  return { newId: (prefix: string) => `${prefix}_${++next}` };
}
export function setup(doc: BoardDoc = newBoardDoc('Plaat')) {
  expect(project.projectEngine).toBeDefined();
  expect(components.componentsEngine).toBeDefined();
  const result = createEngine({
    modules: [
      project.projectEngine,
      components.componentsEngine,
      photo.photoEngine,
      connectionsEngine,
      netsEngine,
    ],
    reserved,
    clock: { now: () => '2026-11-08T10:00:00.000Z' },
  });
  result.host.load('feature-test', doc, false);
  return result;
}

export function setupWithAllFeatures(doc: BoardDoc) {
  const result = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => '2026-11-27T10:00:00.000Z' },
  });
  result.host.load('feature-test', doc, false);
  return result;
}
