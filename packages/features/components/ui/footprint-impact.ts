import type { Snapshot } from '@pcbk/contracts';

type Component = Snapshot['doc']['components'][number];

export function footprintImpact(
  component: Component,
  measurements: Snapshot['doc']['measurements'],
  targetIds: readonly string[],
) {
  const retained = new Set(targetIds);
  const removed = component.pins.filter(({ id }) => !retained.has(id));
  const lostUids = new Set(removed.map(({ uid }) => uid));
  const affected = measurements.filter(
    ({ at, ref }) => lostUids.has(at.uid) || (ref !== undefined && lostUids.has(ref.uid)),
  );
  const names = removed.filter(({ name }) => name?.trim()).length;
  const nc = removed.filter((pin) => pin.nc).length;
  return {
    pinIds: removed.map(({ id }) => id),
    measurements: affected.length,
    names,
    nc,
    hasImpact: affected.length + names + nc > 0,
    // A changed identity, name or contact must be reviewed even if the totals stay equal.
    key: JSON.stringify({ pins: removed, measurements: affected }),
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
