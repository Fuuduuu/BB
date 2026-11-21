import { useSnapshot } from '@pcbk/client';
import type { Snapshot } from '@pcbk/contracts';
import type { MeasuredPin, Measurement, PinRef } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import { Button } from '@pcbk/ui';
import type { Selection } from '@pcbk/ui';
import { startBeepPair } from './beep-store';
import { contactFromItem, resolveContact } from './contacts';
import { beepEt } from './i18n/et';

function boardContact(snapshot: Snapshot, { c, p }: PinRef) {
  const contact = contactFromItem(snapshot, { kind: 'pin', id: p, componentId: c });
  if (!contact) return;
  const board = resolveContact(snapshot, contact)?.component.board;
  if (!board) return;
  const [pad] = boardPads(board, [p], snapshot.doc.scale.pxPerMm);
  if (pad) return { contact, at: pad.at };
}

const samePin = (a: PinRef, b: PinRef) => a.c === b.c && a.p === b.p;

function isPastContinuity(measurement: Measurement, anchor: MeasuredPin, target: MeasuredPin) {
  const { at, ref, mode, staleByRepairId } = measurement;
  if (mode !== 'continuity' || !ref) return false;
  const [oldAnchor, oldTarget] = samePin(at, anchor) ? [at, ref] : [ref, at];
  return (
    samePin(oldAnchor, anchor) &&
    samePin(oldTarget, target) &&
    (staleByRepairId !== undefined || oldAnchor.uid !== anchor.uid || oldTarget.uid !== target.uid)
  );
}

export function MeasureAgain({ selection }: { selection: Selection }) {
  const snapshot = useSnapshot((current) => current);
  const [selected] = selection.items;
  if (selection.items.length !== 1 || selected?.kind !== 'connection') return null;
  const connection = snapshot.doc.connections.find(({ id }) => id === selected.id);
  if (
    !connection ||
    !('pin' in connection.a) ||
    !('pin' in connection.b) ||
    snapshot.derived.connectionLevels?.[connection.id]?.level === 'measured'
  ) {
    return null;
  }

  const anchor = boardContact(snapshot, connection.a.pin);
  const target = boardContact(snapshot, connection.b.pin);
  if (!anchor || !target) return null;
  const measuredBefore = snapshot.doc.measurements.some((measurement) =>
    isPastContinuity(measurement, anchor.contact, target.contact),
  );

  return (
    <Button onClick={() => startBeepPair(anchor.contact, target.contact, target.at)}>
      {measuredBefore ? beepEt.measureAgain : beepEt.measureWithBeep}
    </Button>
  );
}
