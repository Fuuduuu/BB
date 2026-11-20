import type { BoardDoc, EndRef } from '@pcbk/domain';
import {
  branchConnection,
  endAcceptsDrawing,
  endKey,
  endRefsByKey,
  removeBoardDrawing,
  removeConnections,
  removeJunctions,
  resolveNets,
} from '@pcbk/domain/rules';
import { CommandTargetNotFound, reject } from '@pcbk/engine';
import type { CommandSpec, EngineModule } from '@pcbk/engine';
import {
  AddConnectionsSchema,
  BranchConnectionSchema,
  ConnectionIdsSchema,
  DrawOnBoardSchema,
} from '../contract';
import type {
  AddConnectionsParams,
  BranchConnectionParams,
  ConnectionIdsParams,
  DrawOnBoardParams,
} from '../contract';

function verifyDrawing(doc: BoardDoc, a: EndRef, b: EndRef, board: DrawOnBoardParams['board']) {
  const { kind, layer } = board;
  if (!endAcceptsDrawing(doc, a, kind, layer) || !endAcceptsDrawing(doc, b, kind, layer))
    reject('layer_mismatch');
}

const add: CommandSpec<AddConnectionsParams> = {
  id: 'connections.add',
  title: 'connections.add',
  params: AddConnectionsSchema,
  run(doc, { items, basis, skipJoined, junctions }) {
    if (junctions) doc.junctions.push(...junctions);
    const endpoints = endRefsByKey(doc);
    for (const item of items) {
      const a = endKey(item.a);
      const b = endKey(item.b);
      if (!endpoints.has(a)) throw new CommandTargetNotFound(a);
      if (!endpoints.has(b)) throw new CommandTargetNotFound(b);
      if (a === b) reject('connection_ends_equal');
      if (item.board) verifyDrawing(doc, item.a, item.b, item.board);
      if (skipJoined) {
        const { netOf } = resolveNets(doc);
        if (netOf.get(a) === netOf.get(b)) continue;
      }
      doc.connections.push({ ...item, basis });
    }
  },
};

const drawOnBoard: CommandSpec<DrawOnBoardParams> = {
  id: 'connections.drawOnBoard',
  title: 'connections.drawOnBoard',
  params: DrawOnBoardSchema,
  run(doc, { id, board }) {
    const connection = doc.connections.find((entry) => entry.id === id);
    if (!connection) throw new CommandTargetNotFound(id);
    if (connection.board) reject('already_drawn');
    verifyDrawing(doc, connection.a, connection.b, board);
    connection.board = board;
    connection.basis = 'visual';
  },
};

const branch: CommandSpec<BranchConnectionParams> = {
  id: 'connections.branch',
  title: 'connections.branch',
  params: BranchConnectionSchema,
  run(doc, input) {
    const plan = branchConnection(doc, input);
    const target = doc.connections[plan.targetIndex]!;
    target.b = plan.targetEnd;
    target.board!.waypoints = plan.targetWaypoints;
    doc.junctions.push(plan.junction);
    doc.connections.push(plan.split, plan.trace);
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
  commands: [add, drawOnBoard, branch, remove, removeDrawing, removeJunction],
};
