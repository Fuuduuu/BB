import { boardPads } from '../geometry/board';
import type { BoardDoc } from '../model/board';
import type { Component } from '../model/component';
import type { Connection, Junction } from '../model/connection';
import type { NetLabel } from '../model/net';
import type { EndRef, Layer, PinRef, Vec2 } from '../model/primitives';
import { RuleRejected, RuleTargetNotFound } from './errors';
import { endAcceptsDrawing } from './layers';
import type { DrawingPositions } from './layers';
import { endKey, endRefsByKey, pinKey, resolveNets } from './nets';
import type { NetMembership } from './nets';

export interface RuleReport {
  removedLabels: NetLabel[];
}

type PinRemoval = { component: Component; pinIds: ReadonlySet<string> };

function newJunction(
  component: Component,
  pinId: string,
  pxPerMm: number,
  used: Set<string>,
  layer?: Layer,
): Junction {
  const base = `jun_${component.id}_${pinId}`;
  let id = base;
  for (let suffix = 2; used.has(id); suffix++) id = `${base}_${suffix}`;
  used.add(id);
  const result: Junction = { id };
  const { board, schematic } = component;
  if (board) {
    const pad = boardPads(board, [pinId], pxPerMm)[0];
    if (pad) result.board = { at: pad.at, layer: layer ?? board.side };
  }
  if (schematic) result.schematic = { at: { ...schematic.at } };
  return result;
}

export function detachPins(doc: BoardDoc, removals: ReadonlyMap<string, PinRemoval>): RuleReport {
  const target = ({ c, p }: PinRef) => {
    const removal = removals.get(c);
    return removal?.pinIds.has(p) ? removal.component : undefined;
  };
  const used = new Set(doc.junctions.map(({ id }) => id));
  const replacements = new Map<string, string>();
  function replace(end: EndRef, layer?: Layer): EndRef {
    if (!('pin' in end)) return end;
    const component = target(end.pin);
    if (!component) return end;
    const key = pinKey(end.pin);
    const previous = replacements.get(key);
    if (previous !== undefined) return { junction: previous };
    const junction = newJunction(component, end.pin.p, doc.scale.pxPerMm, used, layer);
    doc.junctions.push(junction);
    replacements.set(key, junction.id);
    return { junction: junction.id };
  }
  for (const connection of doc.connections) {
    const { a, b, board } = connection;
    const updatedA = replace(a, board?.layer);
    const updatedB = replace(b, board?.layer);
    if (updatedA !== a) connection.a = updatedA;
    if (updatedB !== b) connection.b = updatedB;
  }

  const removedLabels: NetLabel[] = [];
  const labels = doc.netLabels.filter((label) => {
    if (!('pin' in label.anchor) || !target(label.anchor.pin)) return true;
    removedLabels.push(label);
    return false;
  });
  if (removedLabels.length) doc.netLabels = labels;
  return { removedLabels };
}

function junctionId(end: EndRef): string | undefined {
  return 'junction' in end ? end.junction : undefined;
}

export function connectedJunctionIds(connections: readonly Connection[]): Set<string> {
  const ids = new Set<string>();
  for (const { a, b } of connections) {
    if ('junction' in a) ids.add(a.junction);
    if ('junction' in b) ids.add(b.junction);
  }
  return ids;
}

/** Find a surviving member of the original net, preferring the first pin. */
function repairJunctionLabels(
  doc: BoardDoc,
  removedJunctions: ReadonlySet<string>,
  before: NetMembership,
): RuleReport {
  const available = endRefsByKey(doc);
  const chosen = new Map<string, EndRef | undefined>();
  function anchorFor(junction: string): EndRef | undefined {
    const net = before.netOf.get(junction);
    if (net === undefined) return undefined;
    if (!chosen.has(net)) {
      let fallback: EndRef | undefined;
      for (const key of before.members.get(net) ?? []) {
        const end = available.get(key);
        if (!end) continue;
        if ('pin' in end) {
          fallback = end;
          break;
        }
        fallback ??= end;
      }
      chosen.set(net, fallback);
    }
    return chosen.get(net);
  }

  const removedLabels: NetLabel[] = [];
  const labels = doc.netLabels.flatMap((label) => {
    const id = junctionId(label.anchor);
    if (id === undefined || !removedJunctions.has(id)) return [label];
    const destination = anchorFor(id);
    if (destination) {
      const anchor = 'pin' in destination ? { pin: { ...destination.pin } } : { ...destination };
      return [{ ...label, anchor }];
    }
    removedLabels.push(label);
    return [];
  });
  doc.netLabels = labels;
  return { removedLabels };
}

export function removeConnectionItems(
  doc: BoardDoc,
  connectionIds: ReadonlySet<string>,
  junctionIds: ReadonlySet<string>,
  before?: NetMembership,
): RuleReport {
  const connections = doc.connections.filter(({ id, a, b }) => {
    const aId = junctionId(a);
    const bId = junctionId(b);
    return (
      !connectionIds.has(id) &&
      (aId === undefined || !junctionIds.has(aId)) &&
      (bId === undefined || !junctionIds.has(bId))
    );
  });
  const lostConnections = connections.length !== doc.connections.length;
  if (!lostConnections && !doc.junctions.some(({ id }) => junctionIds.has(id))) {
    return { removedLabels: [] };
  }
  const inUse = connectedJunctionIds(connections);
  const removed = new Set<string>();
  const junctions = doc.junctions.filter(({ id }) => {
    if (inUse.has(id) && !junctionIds.has(id)) return true;
    removed.add(id);
    return false;
  });
  const hasAffectedLabels = doc.netLabels.some(
    ({ anchor }) => 'junction' in anchor && removed.has(anchor.junction),
  );
  const previous = hasAffectedLabels ? (before ?? resolveNets(doc)) : undefined;
  if (lostConnections) doc.connections = connections;
  if (removed.size) doc.junctions = junctions;
  return previous ? repairJunctionLabels(doc, removed, previous) : { removedLabels: [] };
}

export function removeConnections(doc: BoardDoc, ids: readonly string[]): RuleReport {
  return removeConnectionItems(doc, new Set(ids), new Set());
}

export function removeJunctions(doc: BoardDoc, ids: readonly string[]): RuleReport {
  return removeConnectionItems(doc, new Set(), new Set(ids));
}

export function removeBoardDrawing(doc: BoardDoc, ids: readonly string[]): void {
  const selected = new Set(ids);
  for (const connection of doc.connections) {
    if (selected.has(connection.id)) delete connection.board;
  }
}

type Drawing = NonNullable<Connection['board']>;

type AttachmentConnection = Pick<Connection, 'a' | 'b'> & {
  readonly board?: Pick<Drawing, 'kind' | 'layer'> | undefined;
};

export function validateJunctionAttachment(
  doc: DrawingPositions & { readonly connections: readonly AttachmentConnection[] },
  id: string,
  pin: PinRef,
): void {
  if (!doc.junctions.some((junction) => junction.id === id)) throw new RuleTargetNotFound(id);
  const component = doc.components.find(({ id }) => id === pin.c);
  if (!component?.pins.some(({ id }) => id === pin.p)) throw new RuleTargetNotFound(pinKey(pin));
  for (const { a, b, board } of doc.connections) {
    if (!board || (junctionId(a) !== id && junctionId(b) !== id)) continue;
    if (!endAcceptsDrawing(doc, { pin }, board.kind, board.layer)) {
      throw new RuleRejected('layer_mismatch');
    }
  }
}

export function attachJunctionToPin(doc: BoardDoc, id: string, pin: PinRef): RuleReport {
  validateJunctionAttachment(doc, id, pin);
  const replace = (end: EndRef): EndRef => (junctionId(end) === id ? { pin: { ...pin } } : end);

  doc.connections = doc.connections.flatMap((connection) => {
    const a = replace(connection.a);
    const b = replace(connection.b);
    if (a === connection.a && b === connection.b) return [connection];
    return endKey(a) === endKey(b) ? [] : [{ ...connection, a, b }];
  });
  for (const label of doc.netLabels) {
    const anchor = replace(label.anchor);
    if (anchor !== label.anchor) label.anchor = anchor;
  }
  doc.junctions = doc.junctions.filter((junction) => junction.id !== id);
  return { removedLabels: [] };
}

type BranchTarget = Pick<Connection, 'id' | 'b' | 'basis'> & {
  readonly board?:
    (Omit<Drawing, 'waypoints'> & { readonly waypoints: readonly Vec2[] }) | undefined;
};

interface BranchInput {
  target: string;
  segment: number;
  at: Vec2;
  junctionId: string;
  splitId: string;
  trace: Pick<Connection, 'id' | 'a' | 'b' | 'board'>;
}

interface BranchPlan {
  targetIndex: number;
  junction: Junction;
  targetEnd: EndRef;
  targetWaypoints: Vec2[];
  split: Connection;
  trace: Connection;
}

/** Prepare all edits together so the preview and the command validate the same branch. */
export function branchConnection(
  doc: DrawingPositions & { readonly connections: readonly BranchTarget[] },
  input: BranchInput,
): BranchPlan {
  const { at, junctionId, segment, splitId, trace } = input;
  const targetIndex = doc.connections.findIndex(({ id }) => id === input.target);
  const target = doc.connections[targetIndex];
  if (!target) throw new RuleTargetNotFound(input.target);

  const board = target.board;
  if (!board) throw new RuleRejected('not_drawn');
  if (!Number.isInteger(segment) || segment < 0 || segment > board.waypoints.length)
    throw new RuleRejected('invalid_segment');
  if (!('junction' in trace.b) || trace.b.junction !== junctionId)
    throw new RuleRejected('branch_end_mismatch');
  const newDrawing = trace.board;
  if (!newDrawing) throw new RuleRejected('not_drawn');
  if (
    (newDrawing.kind === 'trace' && newDrawing.layer !== board.layer) ||
    !endAcceptsDrawing(doc, trace.a, newDrawing.kind, newDrawing.layer)
  ) {
    throw new RuleRejected('layer_mismatch');
  }

  return {
    targetIndex,
    junction: { id: junctionId, board: { at, layer: board.layer } },
    targetEnd: { junction: junctionId },
    targetWaypoints: board.waypoints.slice(0, segment),
    split: {
      id: splitId,
      a: { junction: junctionId },
      b: target.b,
      basis: target.basis,
      board: {
        kind: board.kind,
        layer: board.layer,
        widthMm: board.widthMm,
        waypoints: board.waypoints.slice(segment),
      },
    },
    trace: { ...trace, basis: 'visual' },
  };
}
