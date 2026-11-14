import { newBoardDoc } from '@pcbk/domain';
import type { BoardDoc, DocKey } from '@pcbk/domain';
import { createEngine } from '@pcbk/engine';
import { expect } from 'vitest';
import * as project from '../project/engine/index';
import * as components from '../components/engine/index';
import * as photo from '../photo/engine/index';

const reserved: DocKey[] = [
  'junctions',
  'connections',
  'netLabels',
  'roles',
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
    modules: [project.projectEngine, components.componentsEngine, photo.photoEngine],
    reserved,
    clock: { now: () => '2026-11-08T10:00:00.000Z' },
  });
  result.host.load('feature-test', doc, false);
  return result;
}
