import type { BoardDoc } from '@pcbk/domain';
import { schematicContacts, schematicSymbolId, snapToSchematicGrid } from '@pcbk/domain/schematic';
import { CommandTargetNotFound, reject } from '@pcbk/engine';
import type { CommandSpec, EngineModule } from '@pcbk/engine';
import { SchematicPlaceSchema, SchematicRemoveSchema, SchematicSetSymbolSchema } from '../contract';
import type {
  SchematicPlaceParams,
  SchematicRemoveParams,
  SchematicSetSymbolParams,
} from '../contract';

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

const setSymbol: CommandSpec<SchematicSetSymbolParams> = {
  id: 'schematic.setSymbol',
  title: 'schematic.setSymbol',
  params: SchematicSetSymbolSchema,
  alsoWrites: ['components'],
  run(doc, { id, pinMap }) {
    const target = component(doc, id);
    const placement = target.schematic;
    if (!placement) reject('component_not_on_schematic');
    if (pinMap === null) {
      delete placement.pinMap;
      return;
    }

    const contacts = schematicContacts(target.kind);
    const pinIds = new Set(target.pins.map((pin) => pin.id));
    const mappedPins = Object.values(pinMap);
    if (
      contacts.length === 0 ||
      contacts.length !== mappedPins.length ||
      contacts.some((contact) => !Object.hasOwn(pinMap, contact)) ||
      new Set(mappedPins).size !== mappedPins.length ||
      mappedPins.some((pinId) => !pinIds.has(pinId))
    ) {
      reject('invalid_pin_map');
    }
    placement.pinMap = pinMap;
  },
};

export const schematicEngine: EngineModule = {
  id: 'schematic',
  dependsOn: ['components'],
  commands: [place, remove, setSymbol],
};
