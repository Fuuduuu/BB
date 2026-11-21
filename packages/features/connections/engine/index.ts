import type { BoardDoc, EndRef } from '@pcbk/domain';
import {
  attachJunctionToPin,
  branchConnection,
  createNetConnectivity,
  endAcceptsDrawing,
  endKey,
  endRefsByKey,
  isEmptyReport,
  removeBoardDrawing,
  removeConnections,
  removeJunctions,
} from '@pcbk/domain/rules';
import { CommandTargetNotFound, reject } from '@pcbk/engine';
import type { CommandSpec, EngineModule } from '@pcbk/engine';
import {
  AddConnectionsSchema,
  AttachJunctionToPinSchema,
  BranchConnectionSchema,
  ConnectionIdsSchema,
  DrawOnBoardSchema,
  InsertWaypointSchema,
  MoveJunctionSchema,
  RemoveWaypointSchema,
  SetLabelOffsetSchema,
  UpdateConnectionSchema,
} from '../contract';
import type {
  AddConnectionsParams,
  AttachJunctionToPinParams,
  BranchConnectionParams,
  ConnectionIdsParams,
  DrawOnBoardParams,
  InsertWaypointParams,
  MoveJunctionParams,
  RemoveWaypointParams,
  SetLabelOffsetParams,
  UpdateConnectionParams,
} from '../contract';
import { connectionLevelsDerive } from './derive';

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
    const connectivity = skipJoined ? createNetConnectivity(doc, endpoints) : undefined;
    for (const item of items) {
      const a = endKey(item.a);
      const b = endKey(item.b);
      if (!endpoints.has(a)) throw new CommandTargetNotFound(a);
      if (!endpoints.has(b)) throw new CommandTargetNotFound(b);
      if (a === b) reject('connection_ends_equal');
      if (item.board) verifyDrawing(doc, item.a, item.b, item.board);
      if (connectivity && connectivity.find(a) === connectivity.find(b)) continue;
      doc.connections.push({ ...item, basis });
      connectivity?.union(a, b);
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

function boardDrawing(doc: BoardDoc, id: string) {
  const connection = doc.connections.find((connection) => connection.id === id);
  if (!connection) throw new CommandTargetNotFound(id);
  if (!connection.board) reject('not_drawn');
  return connection.board;
}

function verifyWaypointIndex(index: number, last: number) {
  if (!Number.isInteger(index) || index < 0 || index > last) reject('invalid_waypoint');
}

const update: CommandSpec<UpdateConnectionParams> = {
  id: 'connections.update',
  title: 'connections.update',
  params: UpdateConnectionSchema,
  run(doc, { id, waypoints }) {
    boardDrawing(doc, id).waypoints = waypoints;
  },
};

const insertWaypoint: CommandSpec<InsertWaypointParams> = {
  id: 'connections.insertWaypoint',
  title: 'connections.insertWaypoint',
  params: InsertWaypointSchema,
  run(doc, { id, index, at }) {
    const { waypoints } = boardDrawing(doc, id);
    verifyWaypointIndex(index, waypoints.length);
    waypoints.splice(index, 0, at);
  },
};

const removeWaypoint: CommandSpec<RemoveWaypointParams> = {
  id: 'connections.removeWaypoint',
  title: 'connections.removeWaypoint',
  params: RemoveWaypointSchema,
  run(doc, { id, index }) {
    const { waypoints } = boardDrawing(doc, id);
    verifyWaypointIndex(index, waypoints.length - 1);
    waypoints.splice(index, 1);
  },
};

const setLabelOffset: CommandSpec<SetLabelOffsetParams> = {
  id: 'connections.setLabelOffset',
  title: 'connections.setLabelOffset',
  params: SetLabelOffsetSchema,
  run(doc, { id, offset }) {
    const board = boardDrawing(doc, id);
    if (offset === null) delete board.labelOffset;
    else board.labelOffset = offset;
  },
};

const moveJunction: CommandSpec<MoveJunctionParams> = {
  id: 'junctions.move',
  title: 'junctions.move',
  params: MoveJunctionSchema,
  run(doc, { id, at }) {
    const junction = doc.junctions.find((junction) => junction.id === id);
    if (!junction) throw new CommandTargetNotFound(id);
    if (!junction.board) reject('not_on_board');
    junction.board.at = at;
  },
};

const attachJunction: CommandSpec<AttachJunctionToPinParams> = {
  id: 'junctions.attachToPin',
  title: 'junctions.attachToPin',
  params: AttachJunctionToPinSchema,
  alsoWrites: ['netLabels'],
  run(doc, { id, pin }) {
    attachJunctionToPin(doc, id, pin);
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
  run(doc, { ids }, ctx) {
    const report = removeConnections(doc, existingIds(doc.connections, ids));
    if (!isEmptyReport(report)) ctx.emit({ type: 'rules.report', payload: report });
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
  run(doc, { ids }, ctx) {
    const report = removeJunctions(doc, existingIds(doc.junctions, ids));
    if (!isEmptyReport(report)) ctx.emit({ type: 'rules.report', payload: report });
  },
};

export const connectionsEngine: EngineModule = {
  id: 'connections',
  owns: ['connections', 'junctions'],
  commands: [
    add,
    drawOnBoard,
    branch,
    update,
    insertWaypoint,
    removeWaypoint,
    setLabelOffset,
    remove,
    removeDrawing,
    moveJunction,
    attachJunction,
    removeJunction,
  ],
  derive: [connectionLevelsDerive],
};
