import { z } from 'zod';
import type { BoardDoc, DocKey } from '../model/board';
import type { Vec2 } from '../model/primitives';
import { RuleRejected, RuleTargetNotFound } from './errors';

export const ItemRefSchema = z.strictObject({ kind: z.literal('component'), id: z.string() });
export type ItemRef = z.infer<typeof ItemRefSchema>;

export const ITEM_FIELDS = ['components'] as const satisfies readonly DocKey[];

export function deleteItems(doc: BoardDoc, ids: readonly string[]): void {
  const selected = new Set(ids);
  const remaining = doc.components.filter((item) => !selected.has(item.id));
  if (remaining.length !== doc.components.length) doc.components = remaining;
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

export function removePins(doc: BoardDoc, componentId: string, pinIds: readonly string[]): void {
  const component = doc.components.find(({ id }) => id === componentId);
  if (!component) throw new RuleTargetNotFound(componentId);

  const requested = new Set(pinIds);
  const removed = new Set<string>();
  const remaining = component.pins.filter(({ id }) => {
    if (!requested.has(id)) return true;
    removed.add(id);
    return false;
  });
  if (removed.size === 0) return;

  component.pins = remaining;
  const { board } = component;
  if (!board) return;
  for (const id of removed) delete board.customPads[id];
  if (board.padMap) {
    for (const [padId, pinId] of Object.entries(board.padMap)) {
      if (removed.has(pinId)) delete board.padMap[padId];
    }
  }
}
