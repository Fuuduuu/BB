import type { Snapshot } from '@pcbk/contracts';
import type { BoardPlacement, Pin } from '@pcbk/domain';
import { footprintGeometry } from '@pcbk/domain/footprints';
import type { Selection } from '@pcbk/ui';
import { selectComponent } from '../contract';

export function nextPinId(pins: readonly Pick<Pin, 'id'>[]): string {
  const used = new Set(pins.map(({ id }) => id));
  let next = 1;
  while (used.has(String(next))) next++;
  return String(next);
}

export function ownPadSizeMm(board: BoardPlacement): number {
  let size = Infinity;
  const geometry = footprintGeometry(board.footprint, board.params);
  for (const { w, h } of geometry?.pads ?? []) size = Math.min(size, w, h);
  for (const { sizeMm } of Object.values(board.customPads)) size = Math.min(size, sizeMm);
  return size === Infinity ? 1 : size;
}

export function ownPinTarget(snapshot: Snapshot, selection: Selection) {
  const [item] = selection.items;
  if (selection.items.length !== 1 || !item) return undefined;
  const id =
    item.kind === 'component' ? item.id : item.kind === 'pin' ? item.componentId : undefined;
  const component = id === undefined ? undefined : selectComponent(snapshot, id);
  return component?.board
    ? { id: component.id, pins: component.pins, board: component.board }
    : undefined;
}
