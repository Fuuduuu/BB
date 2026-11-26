import type { BoardDoc, Component } from '@pcbk/domain';
import { componentTopology, connectionLevels } from '@pcbk/domain/rules';
import type { DeriveSpec } from '@pcbk/engine';
import { ConnectionLevelsSchema } from '../contract';

export const connectionLevelsDerive: DeriveSpec<'connectionLevels'> = {
  key: 'connectionLevels',
  inputs: [
    {
      key: 'components',
      select: (doc) => componentTopology(doc.components as readonly Component[]),
    },
    'connections',
    'junctions',
    'measurements',
  ],
  schema: ConnectionLevelsSchema,
  initial: {},
  run: (doc) => connectionLevels(doc as BoardDoc),
};
