import type { IdGen } from '@pcbk/contracts';
import { refPrefix } from '@pcbk/domain';
import type { FootprintParams } from '@pcbk/domain';
import {
  COMPONENT_LIBRARY,
  makePlacedComponent,
  type AddComponentParams,
} from '@pcbk/features/components/contract';
import type { AddMeasurementParams } from '@pcbk/features/measurements/contract';

export type SyntheticBoard = {
  components: AddComponentParams[];
  measurements: AddMeasurementParams[];
  surface: { width: number; height: number };
};

export function generateSyntheticBoard(opts: {
  seed: number;
  ids: IdGen;
  at: string;
}): SyntheticBoard {
  const random = mulberry32(opts.seed);
  // Each group has 50 pins; 60 groups give exactly 300 components and 3000 pins.
  const mix: { id: string; params: FootprintParams }[] = [
    { id: 'r_smd', params: {} },
    { id: 'c_smd', params: {} },
    { id: 'sot23', params: {} },
    { id: 'soic', params: { pins: 28 } },
    { id: 'hdr1', params: { pins: 15, pitch: 1.27 } },
  ];
  const entries = Array.from({ length: 60 }, () => mix).flat();
  for (let index = entries.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [entries[index], entries[other]] = [entries[other]!, entries[index]!];
  }
  const references = new Map<string, number>();
  const components = entries.map((choice, index) => {
    const entry = COMPONENT_LIBRARY.find((item) => item.id === choice.id);
    if (!entry) throw new Error(`Missing synthetic component library entry: ${choice.id}`);
    // At 10 px/mm, even the 15-pin header fits a 200×200 px cell in every rotation.
    const component = makePlacedComponent(opts.ids, entry, choice.params, {
      x: (index % 20) * 200 + 100,
      y: Math.floor(index / 20) * 200 + 100,
    });
    const prefix = refPrefix(entry.kind);
    const number = (references.get(prefix) ?? 0) + 1;
    references.set(prefix, number);
    return {
      ...component,
      ref: `${prefix}${number}`,
      board: {
        ...component.board!,
        rotationDeg: (index % 4) * 90,
        side: index % 10 === 0 ? ('bottom' as const) : ('top' as const),
      },
    };
  });
  const measurements: AddMeasurementParams[] = [];
  let pinIndex = 0;
  for (const component of components) {
    for (const pin of component.pins) {
      if (pinIndex++ % 2 !== 0) continue;
      measurements.push({
        id: opts.ids.newId('msr'),
        at: { c: component.id, p: pin.id, uid: pin.uid },
        takenAt: opts.at,
        mode: 'voltage',
        power: 'on',
        value: Math.round(random() * 5000) / 1000,
      });
    }
  }
  return { components, measurements, surface: { width: 4000, height: 3000 } };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
