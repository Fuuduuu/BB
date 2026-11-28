import type { AddComponentParams } from '@pcbk/features/components/contract';
import {
  MONO_ADVANCE_EM,
  SCHEMATIC_GRID_MM,
  schematicSymbol,
  symbolToSchematic,
} from '@pcbk/domain/schematic';
import type { SymbolPrim } from '@pcbk/domain/schematic';

type Placement = NonNullable<AddComponentParams['schematic']>;
type Text = Extract<SymbolPrim, { kind: 'text' }>;
type Point = { x: number; y: number };
const grid = SCHEMATIC_GRID_MM;

function textBounds({ at, size, text, anchor }: Text): [Point, Point] {
  const width = Array.from(text).length * size * MONO_ADVANCE_EM;
  const x = at.x - (anchor === 'middle' ? width / 2 : anchor === 'end' ? width : 0);
  return [
    { x, y: at.y - size / 2 },
    { x: x + width, y: at.y + size / 2 },
  ];
}

function occupiedCells(component: AddComponentParams, rot: 0 | 90) {
  const symbol = schematicSymbol({
    kind: component.kind,
    pins: component.pins.map((pin) => ({ ...pin, nc: false })),
  });
  if (!symbol || !component.ref) throw new Error('Missing synthetic schematic symbol or reference');
  const orient = (point: Point) =>
    symbolToSchematic({ at: { x: 0, y: 0 }, rot, mirror: false }, point);
  const rotatedAreas: [Point, Point][] = [
    [symbol.bounds.min, symbol.bounds.max],
    ...symbol.pins.map(({ inner, end }): [Point, Point] => [inner, end]),
    ...symbol.prims.flatMap((prim) => (prim.kind === 'text' ? [textBounds(prim)] : [])),
  ];
  const areas = [
    ...rotatedAreas.map(([a, b]): [Point, Point] => [orient(a), orient(b)]),
    textBounds({
      kind: 'text',
      text: component.ref + '?',
      size: grid,
      at: orient(symbol.label),
      anchor: 'middle',
    }),
  ];
  const cells = new Map<string, Point>();
  for (const [a, b] of areas) {
    const left = Math.floor(Math.min(a.x, b.x) / grid);
    const top = Math.floor(Math.min(a.y, b.y) / grid);
    // A grid cell shared by two extents would risk touching outlines or pin endpoints.
    const right = Math.floor(Math.max(a.x, b.x) / grid + 0.05);
    const bottom = Math.floor(Math.max(a.y, b.y) / grid + 0.05);
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) cells.set(`${x}:${y}`, { x, y });
    }
  }
  const points = [...cells.values()];
  const left = Math.min(...points.map(({ x }) => x));
  const top = Math.min(...points.map(({ y }) => y));
  const width = Math.max(...points.map(({ x }) => x)) - left + 1;
  const height = Math.max(...points.map(({ y }) => y)) - top + 1;
  // Scanning occupied cells in row order rejects a collision early during packing.
  const footprint = points
    .map(({ x, y }) => ({ x: x - left, y: y - top }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  return { rot, left, top, width, height, footprint };
}

export function placeSyntheticSymbols(components: AddComponentParams[]): Placement[] {
  const columns = Math.floor(420 / grid);
  const rows = Math.floor(297 / grid);
  const occupied = Array.from({ length: rows }, () => new Uint8Array(columns));
  const symbols = components
    .map((component, index) => ({
      index,
      variants: [occupiedCells(component, 0), occupiedCells(component, 90)],
    }))
    .sort((a, b) => b.variants[0]!.height - a.variants[0]!.height);
  const placements: Placement[] = [];
  for (const { index, variants } of symbols) {
    let cell: { column: number; row: number; shape: ReturnType<typeof occupiedCells> } | undefined;
    scan: for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        for (const shape of variants) {
          if (row + shape.height > rows || column + shape.width > columns) continue;
          if (!shape.footprint.every(({ x, y }) => !occupied[row + y]![column + x])) continue;
          cell = { column, row, shape };
          break scan;
        }
      }
    }
    if (!cell) throw new Error('Synthetic schematic symbols do not fit on A3');
    const { column, row, shape } = cell;
    for (const { x, y } of shape.footprint) occupied[row + y]![column + x] = 1;
    placements[index] = {
      at: { x: (column - shape.left) * grid, y: (row - shape.top) * grid },
      rot: shape.rot,
      mirror: false,
    };
  }
  return placements;
}
