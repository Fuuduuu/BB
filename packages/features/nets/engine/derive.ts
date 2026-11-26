import type { BoardDoc, Component } from '@pcbk/domain';
import { componentTopology, describeNets } from '@pcbk/domain/rules';
import type { DeriveSpec } from '@pcbk/engine';
import { NetsDerivedSchema } from '../contract';

export const netsDerivations: DeriveSpec[] = [
  {
    key: 'nets',
    inputs: [
      {
        key: 'components',
        select: (doc) => componentTopology(doc.components as readonly Component[]),
      },
      'connections',
      'junctions',
      'netLabels',
      'roles',
      'measurements',
    ],
    schema: NetsDerivedSchema,
    initial: { list: [], netOf: {}, shortedComponents: [] },
    // The domain rule only reads the snapshot and builds a fresh description.
    run: (doc) => describeNets(doc as BoardDoc),
  },
];
