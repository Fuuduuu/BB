import type { BoardDoc } from '@pcbk/domain';
import { schematicSymbolId, snapToSchematicGrid } from '@pcbk/domain/schematic';
import { CommandTargetNotFound, reject } from '@pcbk/engine';
import type { CommandSpec, EngineModule } from '@pcbk/engine';
import { SchematicPlaceSchema, SchematicRemoveSchema } from '../contract';
import type { SchematicPlaceParams, SchematicRemoveParams } from '../contract';

function component(doc: BoardDoc, id: string) {
  const target = doc.components.find((item) => item.id === id);
  if (!target) throw new CommandTargetNotFound(id);
  return target;
}

const place: CommandSpec<SchematicPlaceParams> = {
  id: 'schematic.place',
  title: 'schematic.place',
  params: SchematicPlaceSchema,
  alsoWrites: ['components'],
  run(doc, { items }) {
    for (const { id, at, rot, mirror } of items) {
      const target = component(doc, id);
      const symbol = schematicSymbolId(target.kind);
      if (symbol === null) reject('no_symbol');
      target.schematic = {
        ...target.schematic,
        symbol,
        at: snapToSchematicGrid(at),
        rot,
        mirror,
      };
    }
  },
};

const remove: CommandSpec<SchematicRemoveParams> = {
  id: 'schematic.remove',
  title: 'schematic.remove',
  params: SchematicRemoveSchema,
  alsoWrites: ['components'],
  run(doc, { ids }) {
    for (const id of new Set(ids)) delete component(doc, id).schematic;
  },
};

export const schematicEngine: EngineModule = {
  id: 'schematic',
  dependsOn: ['components'],
  commands: [place, remove],
};
