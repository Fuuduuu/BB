import type { DocumentEngine, IdGen, Snapshot } from '@pcbk/contracts';
import type { MeasuredPin } from '@pcbk/domain';
import { endKey, pinKey } from '@pcbk/domain/rules';
import type { AddConnectionsParams } from '@pcbk/features/connections/contract';
import type { BeepRecordParams } from '@pcbk/features/measurements/contract';

export function anchorPinCount(snapshot: Snapshot, anchor: MeasuredPin): number {
  const nets = snapshot.derived.nets;
  const key = nets?.netOf[pinKey(anchor)];
  if (!key) return 0;
  return nets!.list.find((net) => net.key === key)?.members.length ?? 0;
}

function makeBeep(ids: IdGen, at: string, anchor: MeasuredPin, pin: MeasuredPin): BeepRecordParams {
  return {
    measurementId: ids.newId('msr'),
    connectionId: ids.newId('con'),
    takenAt: at,
    anchor,
    pin,
    beep: true,
    connect: true,
  };
}

export function addProbeBranches(
  engine: DocumentEngine,
  ids: IdGen,
  at: string,
  sampleConnection: AddConnectionsParams,
) {
  const before = engine.snapshot();
  const occupied = new Set(
    [...before.doc.connections, ...sampleConnection.items].flatMap(({ a, b }) => [
      endKey(a),
      endKey(b),
    ]),
  );
  // Use at most one free pin from each component, including the anchor and the measured contact.
  const contacts: MeasuredPin[] = [];
  for (const { id, pins } of before.doc.components) {
    const pin = pins.find(({ id: pinId }) => !occupied.has(pinKey({ c: id, p: pinId })));
    if (pin) contacts.push({ c: id, p: pin.id, uid: pin.uid });
    if (contacts.length === 52) break;
  }
  if (contacts.length !== 52)
    throw new Error('The probe needs 52 free pins on different components');
  const anchor = contacts[0]!;
  for (const pin of contacts.slice(1, -1)) {
    const result = engine.execute('beep.record', makeBeep(ids, at, anchor, pin));
    if (!result.ok) throw new Error(`Cannot record probe branch: ${JSON.stringify(result)}`);
  }
  const after = engine.snapshot();
  if (after.doc.measurements.length !== before.doc.measurements.length + 50)
    throw new Error('Expected 50 new branch measurements');
  return { anchor, nextBeep: () => makeBeep(ids, at, anchor, contacts[51]!) };
}
