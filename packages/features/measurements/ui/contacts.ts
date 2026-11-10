import type { Snapshot } from '@pcbk/contracts';
import type { MeasuredPin } from '@pcbk/domain';
import type { Selection, SelectionItem } from '@pcbk/ui';

function findPin(snapshot: Snapshot, componentId: string, pinId: string) {
  const component = snapshot.doc.components.find(({ id }) => id === componentId);
  const pin = component?.pins.find(({ id }) => id === pinId);
  return component && pin ? { component, pin } : undefined;
}

export function resolveContact(snapshot: Snapshot, contact: MeasuredPin) {
  const found = findPin(snapshot, contact.c, contact.p);
  return found?.pin.uid === contact.uid ? found : undefined;
}

export function contactFromItem(snapshot: Snapshot, item?: SelectionItem): MeasuredPin | null {
  if (item?.kind !== 'pin' || !item.componentId) return null;
  const found = findPin(snapshot, item.componentId, item.id);
  return found ? { c: found.component.id, p: found.pin.id, uid: found.pin.uid } : null;
}

export function contactFromSelection(snapshot: Snapshot, selection: Selection): MeasuredPin | null {
  return selection.items.length === 1 ? contactFromItem(snapshot, selection.items[0]) : null;
}
