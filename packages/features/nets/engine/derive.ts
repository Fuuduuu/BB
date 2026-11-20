import type { BoardDoc } from '@pcbk/domain';
import { describeNets } from '@pcbk/domain/rules';
import type { DeriveSpec } from '@pcbk/engine';
import { NetsDerivedSchema } from '../contract';

export const netsDerivations: DeriveSpec[] = [
  {
    key: 'nets',
    inputs: ['components', 'connections', 'junctions', 'netLabels', 'roles', 'measurements'],
    schema: NetsDerivedSchema,
    initial: { list: [], netOf: {}, shortedComponents: [] },
    // The domain rule only reads the snapshot and builds a fresh description.
    run: (doc) => describeNets(doc as BoardDoc),
  },
];
