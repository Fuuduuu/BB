import {
  endKey,
  endRefsByKey,
  removeBoardDrawing,
  removeConnections,
  removeJunctions,
  resolveNets,
} from '@pcbk/domain/rules';
import { CommandTargetNotFound, reject } from '@pcbk/engine';
import type { CommandSpec, EngineModule } from '@pcbk/engine';
import { AddConnectionsSchema, ConnectionIdsSchema } from '../contract';
import type { AddConnectionsParams, ConnectionIdsParams } from '../contract';

const add: CommandSpec<AddConnectionsParams> = {
  id: 'connections.add',
  title: 'connections.add',
  params: AddConnectionsSchema,
  run(doc, { items, basis, skipJoined }) {
    const endpoints = endRefsByKey(doc);
    for (const item of items) {
      const a = endKey(item.a);
      const b = endKey(item.b);
      if (!endpoints.has(a)) throw new CommandTargetNotFound(a);
      if (!endpoints.has(b)) throw new CommandTargetNotFound(b);
      if (a === b) reject('connection_ends_equal');
      if (skipJoined) {
        const { netOf } = resolveNets(doc);
        if (netOf.get(a) === netOf.get(b)) continue;
      }
      doc.connections.push({ ...item, basis });
    }
  },
};

function existingIds(records: readonly { id: string }[], ids: readonly string[]): string[] {
  const available = new Set(records.map(({ id }) => id));
  const selected = [...new Set(ids)];
  for (const id of selected) {
    if (!available.has(id)) throw new CommandTargetNotFound(id);
  }
  return selected;
}

const remove: CommandSpec<ConnectionIdsParams> = {
  id: 'connections.remove',
  title: 'connections.remove',
  params: ConnectionIdsSchema,
  alsoWrites: ['netLabels'],
  run(doc, { ids }) {
    removeConnections(doc, existingIds(doc.connections, ids));
  },
};

const removeDrawing: CommandSpec<ConnectionIdsParams> = {
  id: 'connections.removeBoardDrawing',
  title: 'connections.removeBoardDrawing',
  params: ConnectionIdsSchema,
  run(doc, { ids }) {
    removeBoardDrawing(doc, existingIds(doc.connections, ids));
  },
};

const removeJunction: CommandSpec<ConnectionIdsParams> = {
  id: 'junctions.remove',
  title: 'junctions.remove',
  params: ConnectionIdsSchema,
  alsoWrites: ['netLabels'],
  run(doc, { ids }) {
    removeJunctions(doc, existingIds(doc.junctions, ids));
  },
};

export const connectionsEngine: EngineModule = {
  id: 'connections',
  owns: ['connections', 'junctions'],
  commands: [add, remove, removeDrawing, removeJunction],
};
