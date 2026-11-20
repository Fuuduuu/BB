import type { EngineError, Snapshot } from '@pcbk/contracts';
import type { EndRef, MeasuredPin, Measurement, Vec2 } from '@pcbk/domain';
import { formatReading } from '@pcbk/domain/measure/reading';
import { endKey, pinKey } from '@pcbk/domain/rules';
import { netsEt } from './i18n/et';

export type Net = NonNullable<Snapshot['derived']['nets']>['list'][number];
export type ConnectionPoints = (
  doc: Snapshot['doc'],
  connection: Snapshot['doc']['connections'][number],
) => readonly Vec2[] | undefined;

export function pinMembers(components: Snapshot['doc']['components']) {
  const pins = new Map<string, MeasuredPin & { label: string }>();
  for (const { id: c, ref, pins: componentPins } of components) {
    for (const { id: p, name, uid } of componentPins) {
      pins.set(pinKey({ c, p }), { c, p, uid, label: `${ref}.${name || p}` });
    }
  }
  return pins;
}

export function netAnchor(net: Net, pins: ReturnType<typeof pinMembers>): EndRef | undefined {
  for (const member of net.members) {
    const pin = pins.get(member);
    if (pin) return { pin: { c: pin.c, p: pin.p } };
  }
  const junction = net.members[0];
  if (junction) return { junction };
}

function currentMember(
  contact: MeasuredPin | undefined,
  members: Set<string>,
  pins: ReturnType<typeof pinMembers>,
) {
  if (!contact) return false;
  const key = pinKey(contact);
  return members.has(key) && pins.get(key)?.uid === contact.uid;
}

function measuredValue({ mode, overload, value }: Measurement) {
  if (overload) return netsEt.overload;
  if (mode === 'voltage' && value !== undefined) return formatReading({ value }, mode);
  return netsEt.unavailable;
}

function measurementRow(measurement: Measurement) {
  const { atLabel, id, mode, refLabel } = measurement;
  const pair = `${atLabel}${refLabel ? ` → ${refLabel}` : ''}`;
  return { id, text: `${measuredValue(measurement)} ${netsEt.measurementModes[mode]} · ${pair}` };
}

export function netDetails(
  snapshot: Snapshot,
  net: Net,
  pinsByKey: ReturnType<typeof pinMembers>,
  connectionPoints: ConnectionPoints,
) {
  const { doc } = snapshot;
  const members = new Set(net.members);
  const pins = net.members.flatMap((key) => {
    const pin = pinsByKey.get(key);
    return pin ? [{ key, ...pin }] : [];
  });
  const connections = doc.connections.filter(({ a }) => members.has(endKey(a)));
  let length = 0;
  for (const connection of connections) {
    if (!connection.board) continue;
    const points = connectionPoints(doc, connection);
    if (!points) continue;
    for (let i = 1; i < points.length; i++) {
      const before = points[i - 1]!;
      const after = points[i]!;
      length += Math.hypot(after.x - before.x, after.y - before.y);
    }
  }
  const measurements = doc.measurements
    .filter(
      ({ at, ref }) =>
        currentMember(at, members, pinsByKey) || currentMember(ref, members, pinsByKey),
    )
    .sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt))
    .map(measurementRow);
  return {
    pins,
    junctions: net.members.length - pins.length,
    connections,
    lengthMm: length / doc.scale.pxPerMm,
    measurements,
  };
}

export function netCommandError(error: EngineError) {
  return error.code === 'read_only' ? netsEt.readOnly : netsEt.commandFailed;
}
