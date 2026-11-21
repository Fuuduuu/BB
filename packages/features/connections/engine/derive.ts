import type { BoardDoc } from '@pcbk/domain';
import { connectionLevels } from '@pcbk/domain/rules';
import type { DeriveSpec } from '@pcbk/engine';
import { ConnectionLevelsSchema } from '../contract';

export const connectionLevelsDerive: DeriveSpec<'connectionLevels'> = {
  key: 'connectionLevels',
  inputs: ['components', 'connections', 'junctions', 'measurements'],
  schema: ConnectionLevelsSchema,
  initial: {},
  run: (doc) => connectionLevels(doc as BoardDoc),
};
