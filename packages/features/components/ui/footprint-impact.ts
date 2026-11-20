import type { Snapshot } from '@pcbk/contracts';

type Component = Snapshot['doc']['components'][number];
type EndRef = Snapshot['doc']['connections'][number]['a'];
type ImpactData = Pick<Snapshot['doc'], 'measurements' | 'connections' | 'netLabels'>;

export function footprintImpact(
  component: Component,
  { measurements, connections, netLabels }: ImpactData,
  targetIds: readonly string[],
) {
  const retained = new Set(targetIds);
  const removed = component.pins.filter(({ id }) => !retained.has(id));
  const lostIds = new Set(removed.map(({ id }) => id));
  const lostUids = new Set(removed.map(({ uid }) => uid));
  const affectedMeasurements = measurements.filter(
    ({ at, ref }) => lostUids.has(at.uid) || (ref !== undefined && lostUids.has(ref.uid)),
  );
  const isLostEnd = (end: EndRef) =>
    'pin' in end && end.pin.c === component.id && lostIds.has(end.pin.p);
  const affectedConnections = connections.filter(({ a, b }) => isLostEnd(a) || isLostEnd(b));
  const affectedLabels = netLabels.filter(({ anchor }) => isLostEnd(anchor));
  const names = removed.filter(({ name }) => name?.trim()).length;
  const nc = removed.filter((pin) => pin.nc).length;
  return {
    pinIds: removed.map(({ id }) => id),
    measurements: affectedMeasurements.length,
    connections: affectedConnections.length,
    netLabels: affectedLabels.length,
    names,
    nc,
    hasImpact:
      affectedMeasurements.length +
        affectedConnections.length +
        affectedLabels.length +
        names +
        nc >
      0,
    // A changed identity, name or contact must be reviewed even if the totals stay equal.
    key: JSON.stringify({
      pins: removed,
      measurements: affectedMeasurements,
      connections: affectedConnections,
      netLabels: affectedLabels,
    }),
  };
}

export function pinRanges(ids: readonly string[]): string {
  const numeric = ids.filter((id) => /^(0|[1-9]\d*)$/.test(id) && Number.isSafeInteger(Number(id)));
  const numericSet = new Set(numeric);
  const sorted = numeric.map(Number).sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let index = 0; index < sorted.length; index++) {
    const start = sorted[index]!;
    let end = start;
    while (sorted[index + 1] === end + 1) end = sorted[++index]!;
    ranges.push(start === end ? String(start) : `${start}–${end}`);
  }
  return [...ranges, ...ids.filter((id) => !numericSet.has(id))].join(', ');
}
