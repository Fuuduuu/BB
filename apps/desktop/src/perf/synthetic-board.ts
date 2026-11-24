import type { IdGen } from '@pcbk/contracts';
import { boardPads, DEFAULT_ROLES, newBoardDoc, refPrefix } from '@pcbk/domain';
import type { BoardPlacement, FootprintParams, Layer, PinRef, Vec2 } from '@pcbk/domain';
import {
  COMPONENT_LIBRARY,
  makePlacedComponent,
  type AddComponentParams,
} from '@pcbk/features/components/contract';
import { TRACE_WIDTH_MM, type AddConnectionsParams } from '@pcbk/features/connections/contract';
import type { AddMeasurementParams } from '@pcbk/features/measurements/contract';
import type { AssignNetParams } from '@pcbk/features/nets/contract';

export type SyntheticBoard = {
  components: AddComponentParams[];
  measurements: AddMeasurementParams[];
  continuity: ContinuityMeasurement[];
  connections: AddConnectionsParams;
  netLabels: AssignNetParams[];
  sampleConnection: AddConnectionsParams;
  surface: { width: number; height: number };
};

type TracePin = { pin: PinRef; at: Vec2 };
type Trace = AddConnectionsParams['items'][number];
type ContinuityMeasurement = Extract<AddMeasurementParams, { mode: 'continuity' }>;
const scale = newBoardDoc('').scale.pxPerMm;

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
  const traces = syntheticTraces(components, opts.ids, random);
  return {
    components,
    measurements,
    ...traces,
    continuity: syntheticContinuity(components, traces.connections.items, opts.ids, opts.at),
    surface: { width: 4000, height: 3000 },
  };
}

function syntheticContinuity(
  components: AddComponentParams[],
  traces: Trace[],
  ids: IdGen,
  takenAt: string,
): ContinuityMeasurement[] {
  const pins = new Map(
    components.map(({ id, pins }) => [id, new Map(pins.map(({ id, uid }) => [id, uid]))]),
  );
  function contact(end: Trace['a']) {
    if (!('pin' in end)) throw new Error('Synthetic traces must connect pins');
    const uid = pins.get(end.pin.c)?.get(end.pin.p);
    if (!uid) throw new Error('Synthetic trace endpoint has no pin UID');
    return { ...end.pin, uid };
  }

  const count = 500;
  return Array.from({ length: count }, (_, index) => {
    const { a, b } = traces[Math.floor((index * traces.length) / count)]!;
    return {
      id: ids.newId('msr'),
      mode: 'continuity',
      at: contact(a),
      ref: contact(b),
      takenAt,
      power: 'off',
      beep: index % 10 !== 0,
    };
  });
}

function tracePins(components: AddComponentParams[], layer: Layer): TracePin[] {
  const byComponent = components
    .filter((component) => component.board?.side === layer)
    .map((component) => {
      const placement: BoardPlacement = {
        ...component.board!,
        params: component.board!.params ?? {},
        rotationDeg: component.board!.rotationDeg ?? 0,
        side: layer,
        scaleX: 1,
        scaleY: 1,
        customPads: {},
      };
      const points = new Map(
        boardPads(
          placement,
          component.pins.map((pin) => pin.id),
          scale,
        ).map(({ pinId, at }) => [pinId, at] as const),
      );
      return component.pins.map((pin): TracePin => ({
        pin: { c: component.id, p: pin.id },
        at: points.get(pin.id)!,
      }));
    });
  // Interleave pin numbers across parts to distribute the traces across the board.
  const pinCount = Math.max(...byComponent.map((pins) => pins.length));
  return Array.from({ length: pinCount }, (_, index) =>
    byComponent.flatMap((pins) => (pins[index] ? [pins[index]] : [])),
  ).flat();
}

function syntheticTraces(
  components: AddComponentParams[],
  ids: IdGen,
  random: () => number,
): Pick<SyntheticBoard, 'connections' | 'netLabels' | 'sampleConnection'> {
  const top = tracePins(components, 'top');
  const bottom = tracePins(components, 'bottom');
  const traceCount = 1000;
  const bottomCount = Math.round((traceCount * bottom.length) / (top.length + bottom.length));
  const trace = (pins: TracePin[], index: number, layer: Layer): Trace => {
    const a = pins[index * 2]!;
    const b = pins[index * 2 + 1]!;
    const count = 1 + Math.floor(random() * 3);
    return {
      id: ids.newId('con'),
      a: { pin: a.pin },
      b: { pin: b.pin },
      board: {
        kind: 'trace',
        layer,
        widthMm: TRACE_WIDTH_MM,
        waypoints: Array.from({ length: count }, (_, bend) => {
          const t = (bend + 1) / (count + 1);
          return {
            x: a.at.x + (b.at.x - a.at.x) * t + (random() - 0.5) * 24,
            y: a.at.y + (b.at.y - a.at.y) * t + (random() - 0.5) * 24,
          };
        }),
      },
    };
  };
  const spread = (pins: TracePin[], count: number, layer: Layer) =>
    Array.from({ length: count }, (_, index) =>
      trace(pins, Math.floor((index * (Math.floor(pins.length / 2) - 1)) / count), layer),
    );
  const upper = spread(top, traceCount - bottomCount, 'top');
  const lower = spread(bottom, bottomCount, 'bottom');
  const namedLabels = (items: Trace[], layer: Layer) =>
    Array.from({ length: DEFAULT_ROLES.length }, (_, index): AssignNetParams => ({
      anchor: items[Math.floor((index * items.length) / DEFAULT_ROLES.length)]!.a,
      labelId: ids.newId('lbl'),
      name: `${layer}-${index + 1}`,
      roleId: DEFAULT_ROLES[index]!.id,
    }));
  const connections: AddConnectionsParams = {
    items: [...upper, ...lower],
    basis: 'visual',
    skipJoined: false,
  };
  return {
    connections,
    netLabels: [...namedLabels(upper, 'top'), ...namedLabels(lower, 'bottom')],
    sampleConnection: {
      ...connections,
      items: [trace(top, Math.floor(top.length / 2) - 1, 'top')],
    },
  };
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
