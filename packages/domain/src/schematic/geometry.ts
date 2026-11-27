import { SCHEMATIC_GRID_MM as grid } from './types';
import type { SymbolPin, SymbolPrim } from './types';

type Coord = readonly [x: number, y: number];

export type SymbolContact = Omit<SymbolPin, 'pinId'>;

type Shape = {
  contacts: readonly SymbolContact[];
  prims: readonly SymbolPrim[];
};

export const point = ([x, y]: Coord) => ({ x, y });

const line = (...points: Coord[]): SymbolPrim => ({ kind: 'line', points: points.map(point) });

const polygon = (points: Coord[], fill = false): SymbolPrim => ({
  kind: 'line',
  points: points.map(point),
  closed: true,
  fill,
});

export const rectangle = (x1: number, y1: number, x2: number, y2: number): SymbolPrim =>
  polygon([
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ]);

const circle = (at: Coord, r: number): SymbolPrim => ({ kind: 'circle', at: point(at), r });

function arrowhead(from: Coord, to: Coord, filled: boolean): SymbolPrim {
  const [x, y] = to;
  const dx = x - from[0];
  const dy = y - from[1];
  const distance = Math.hypot(dx, dy);
  const ux = dx / distance;
  const uy = dy / distance;
  const length = 0.9;
  const halfWidth = 0.38;
  const backX = x - ux * length;
  const backY = y - uy * length;
  const points: Coord[] = [
    [backX - uy * halfWidth, backY + ux * halfWidth],
    to,
    [backX + uy * halfWidth, backY - ux * halfWidth],
  ];
  return filled ? polygon(points, true) : line(...points);
}

function pair(
  left: number,
  right: number,
  prims: readonly SymbolPrim[],
  [a, b]: readonly [string, string] = ['1', '2'],
): Shape {
  return {
    contacts: [
      { contact: a, end: point([-2 * grid, 0]), inner: point([left, 0]) },
      { contact: b, end: point([2 * grid, 0]), inner: point([right, 0]) },
    ],
    prims,
  };
}

function transistor(
  contacts: readonly [string, string, string],
  inputX: number,
  prims: readonly SymbolPrim[],
): Shape {
  return {
    contacts: [
      { contact: contacts[0], end: point([-2 * grid, 0]), inner: point([inputX, 0]) },
      { contact: contacts[1], end: point([grid, -2 * grid]), inner: point([grid, -3.6]) },
      { contact: contacts[2], end: point([grid, 2 * grid]), inner: point([grid, 3.6]) },
    ],
    prims,
  };
}

function coil(): SymbolPrim {
  const radius = 0.9;
  const segments = 12;
  const points: Coord[] = [];
  for (let turn = 0; turn < 4; turn++) {
    const center = (2 * turn - 3) * radius;
    for (let step = 0; step <= segments; step++) {
      if (turn > 0 && step === 0) continue;
      const angle = (step / segments) * Math.PI;
      points.push([center - radius * Math.cos(angle), -radius * Math.sin(angle)]);
    }
  }
  return line(...points);
}

const capacitor = [line([-0.65, -2], [-0.65, 2]), line([0.65, -2], [0.65, 2])];
const diodeBody = polygon([
  [-2, -1.65],
  [1.15, 0],
  [-2, 1.65],
]);
const diodeBar = line([1.15, -1.65], [1.15, 1.65]);
const ledExit: readonly [Coord, Coord] = [
  [0.2, -1.8],
  [1.7, -3.55],
];
const ledSecondExit: readonly [Coord, Coord] = [
  [1.6, -1.7],
  [3.1, -3.45],
];
const emitterRoot: Coord = [-0.9, 1.1];
const emitterEnd: Coord = [grid, 3.6];
const emitterArrowStart: Coord = [0.05, 1.8];
const emitterArrowEnd: Coord = [1.95, 3.18];
const bipolar = [
  line([-0.9, -2.05], [-0.9, 2.05]),
  line([-0.9, -1.1], [grid, -3.6]),
  line(emitterRoot, emitterEnd),
];
const mos = [
  line([-1.1, -1.8], [-1.1, 1.8]),
  line([0, -1.8], [0, 1.8]),
  line([0, -1.3], [grid, -1.3], [grid, -3.6]),
  line([0, 1.3], [grid, 1.3], [grid, 3.6]),
  line([0, 0], [grid, 0], [grid, 1.3]),
];
const mosArrowIn: Coord = [0.1, 0];
const mosArrowOut: Coord = [1.85, 0];

export const shapes = {
  resistor: pair(-grid, grid, [rectangle(-grid, -0.9, grid, 0.9)]),
  capacitor: pair(-0.65, 0.65, capacitor),
  capacitor_polarized: pair(
    -0.65,
    0.65,
    [
      ...capacitor,
      { kind: 'text', at: point([-1.75, -1.95]), text: '+', size: 1.5, anchor: 'middle' },
    ],
    ['+', '-'],
  ),
  inductor: pair(-3.6, 3.6, [coil()]),
  diode: pair(-2, 1.15, [diodeBody, diodeBar], ['A', 'K']),
  led: pair(
    -2,
    1.15,
    [
      diodeBody,
      diodeBar,
      line(...ledExit),
      arrowhead(...ledExit, false),
      line(...ledSecondExit),
      arrowhead(...ledSecondExit, false),
    ],
    ['A', 'K'],
  ),
  zener: pair(
    -2,
    1.15,
    [diodeBody, line([0.45, -2.2], [1.15, -1.65], [1.15, 1.65], [1.85, 2.2])],
    ['A', 'K'],
  ),
  npn: transistor(['B', 'C', 'E'], -0.9, [
    ...bipolar,
    arrowhead(emitterArrowStart, emitterArrowEnd, true),
  ]),
  pnp: transistor(['B', 'C', 'E'], -0.9, [
    ...bipolar,
    arrowhead(emitterArrowEnd, emitterArrowStart, true),
  ]),
  nmos: transistor(['G', 'D', 'S'], -1.1, [...mos, arrowhead(mosArrowOut, mosArrowIn, true)]),
  pmos: transistor(['G', 'D', 'S'], -1.1, [...mos, arrowhead(mosArrowIn, mosArrowOut, true)]),
  crystal: pair(-1.55, 1.55, [
    line([-1.55, -2], [-1.55, 2]),
    line([1.55, -2], [1.55, 2]),
    rectangle(-0.85, -1.6, 0.85, 1.6),
  ]),
  switch: pair(-grid - 0.35, grid + 0.35, [
    circle([-grid, 0], 0.35),
    circle([grid, 0], 0.35),
    line([-grid, -0.35], [1.65, -2.15]),
  ]),
  fuse: pair(-grid, grid, [rectangle(-grid, -0.8, grid, 0.8), line([-grid, 0], [grid, 0])]),
  terminal: {
    contacts: [{ contact: '1', end: point([-grid, 0]), inner: point([-0.65, 0]) }],
    prims: [circle([0, 0], 0.65)],
  },
} satisfies Record<string, Shape>;
