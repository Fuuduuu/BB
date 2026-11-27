import { schematicSymbolId } from '@pcbk/domain/schematic';
import type { DeriveSpec } from '@pcbk/engine';
import { z } from 'zod';

const componentIds = z.array(z.string());

export const componentPlacementDerivations: DeriveSpec[] = [
  {
    key: 'unplacedBoard',
    inputs: ['components'],
    schema: componentIds,
    initial: [],
    run: (doc) => doc.components.filter((item) => !item.board).map((item) => item.id),
  },
  {
    key: 'unplacedSchematic',
    inputs: ['components'],
    schema: componentIds,
    initial: [],
    run: (doc) =>
      doc.components
        .filter((item) => !item.schematic && schematicSymbolId(item.kind) !== null)
        .map((item) => item.id),
  },
];
