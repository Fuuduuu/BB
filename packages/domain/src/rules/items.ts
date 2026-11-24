import { z } from 'zod';
import { boardPads } from '../geometry/board';
import type { BoardDoc, DocKey } from '../model/board';
import type { EndRef, Layer, Vec2 } from '../model/primitives';
import { detachPins, newJunction, otherLayer, removeConnectionItems } from './connections';
import type { RuleReport } from './connections';
import { RuleRejected, RuleTargetNotFound } from './errors';
import { endAcceptsDrawing } from './layers';
import { pinKey, resolveNets } from './nets';

export const ItemRefSchema = z.strictObject({ kind: z.literal('component'), id: z.string() });
export type ItemRef = z.infer<typeof ItemRefSchema>;

export const ITEM_FIELDS = [
  'components',
  'connections',
  'junctions',
  'netLabels',
] as const satisfies readonly DocKey[];

export function deleteItems(doc: BoardDoc, ids: readonly string[]): RuleReport {
  const selected = new Set(ids);
  const removedComponents = doc.components.filter(({ id }) => selected.has(id));
  const connectionIds = new Set(
    doc.connections.filter(({ id }) => selected.has(id)).map(({ id }) => id),
  );
  const junctionIds = new Set(
    doc.junctions.filter(({ id }) => selected.has(id)).map(({ id }) => id),
  );
  const topologyChanges = connectionIds.size > 0 || junctionIds.size > 0;
  const before =
    topologyChanges &&
    removedComponents.length > 0 &&
    doc.netLabels.some(({ anchor }) => 'junction' in anchor)
      ? resolveNets(doc)
      : undefined;
  const removedLabels: RuleReport['removedLabels'] = [];
  if (removedComponents.length > 0) {
    const removals = new Map(
      removedComponents.map((component) => [
        component.id,
        { component, pinIds: new Set(component.pins.map(({ id }) => id)) },
      ]),
    );
    const removedItems = topologyChanges ? { connectionIds, junctionIds } : undefined;
    removedLabels.push(...detachPins(doc, removals, removedItems).removedLabels);
    doc.components = doc.components.filter(({ id }) => !selected.has(id));
  }
  if (topologyChanges) {
    const report = removeConnectionItems(doc, connectionIds, junctionIds, before);
    removedLabels.push(...report.removedLabels);
    return { ...report, removedLabels };
  }
  return { removedLabels };
}

export function translateItems(doc: BoardDoc, items: readonly ItemRef[], delta: Vec2): void {
  const ids = new Set(items.map(({ id }) => id));
  const components = new Map(doc.components.map((component) => [component.id, component]));
  for (const id of ids) {
    const component = components.get(id);
    if (!component) throw new RuleTargetNotFound(id);
    const { board } = component;
    if (!board) throw new RuleRejected('component_not_placed');
    if (delta.x !== 0) board.center.x += delta.x;
    if (delta.y !== 0) board.center.y += delta.y;
  }
}

export function flipComponentSides(doc: BoardDoc, ids: readonly string[]): void {
  const flipped = new Map(
    [...new Set(ids)].map((id) => {
      const component = doc.components.find((part) => part.id === id);
      if (!component) throw new RuleTargetNotFound(id);
      const { board } = component;
      if (!board) throw new RuleRejected('component_not_placed');
      const positions = new Map<string, Vec2>();
      for (const { pinId, at } of boardPads(
        board,
        component.pins.map(({ id: pinId }) => pinId),
        doc.scale.pxPerMm,
      )) {
        if (!positions.has(pinId)) positions.set(pinId, at);
      }
      return [id, { component, board, positions }] as const;
    }),
  );
  for (const { board } of flipped.values()) board.side = otherLayer(board.side);

  const used = new Set(doc.junctions.map(({ id }) => id));
  const replacements = new Map<string, string>();
  function replace(end: EndRef, layer: Layer): EndRef {
    if (!('pin' in end)) return end;
    const previous = flipped.get(end.pin.c);
    const at = previous?.positions.get(end.pin.p);
    if (!previous || !at || endAcceptsDrawing(doc, end, 'trace', layer)) return end;
    const key = `${pinKey(end.pin)}:${layer}`;
    const existing = replacements.get(key);
    if (existing !== undefined) return { junction: existing };
    const junction = newJunction(previous.component, end.pin.p, used, { at, layer });
    doc.junctions.push(junction);
    replacements.set(key, junction.id);
    return { junction: junction.id };
  }
  for (const connection of doc.connections) {
    const { a, b, board } = connection;
    if (board?.kind !== 'trace') continue;
    const updatedA = replace(a, board.layer);
    const updatedB = replace(b, board.layer);
    if (updatedA !== a) connection.a = updatedA;
    if (updatedB !== b) connection.b = updatedB;
  }
}

export function removePins(
  doc: BoardDoc,
  componentId: string,
  pinIds: readonly string[],
): RuleReport {
  const component = doc.components.find(({ id }) => id === componentId);
  if (!component) throw new RuleTargetNotFound(componentId);

  const requested = new Set(pinIds);
  const removed = new Set<string>();
  const remaining = component.pins.filter(({ id }) => {
    if (!requested.has(id)) return true;
    removed.add(id);
    return false;
  });
  if (removed.size === 0) return { removedLabels: [] };

  const report = detachPins(doc, new Map([[componentId, { component, pinIds: removed }]]));
  component.pins = remaining;
  const { board } = component;
  if (!board) return report;
  for (const id of removed) delete board.customPads[id];
  if (board.padMap) {
    for (const [padId, pinId] of Object.entries(board.padMap)) {
      if (removed.has(pinId)) delete board.padMap[padId];
    }
  }
  return report;
}
