import type { Vec2 } from '../model/primitives';

export const SCHEMATIC_GRID_MM = 2.54;

export type SymbolId =
  | 'resistor'
  | 'capacitor'
  | 'capacitor_polarized'
  | 'inductor'
  | 'diode'
  | 'led'
  | 'zener'
  | 'npn'
  | 'pnp'
  | 'nmos'
  | 'pmos'
  | 'crystal'
  | 'switch'
  | 'fuse'
  | 'terminal'
  | 'box';

export type SymbolPrim =
  | Readonly<{
      kind: 'line';
      points: readonly Readonly<Vec2>[];
      closed?: boolean;
      fill?: boolean;
    }>
  | Readonly<{ kind: 'circle'; at: Readonly<Vec2>; r: number; fill?: boolean }>
  | Readonly<{
      kind: 'text';
      at: Readonly<Vec2>;
      text: string;
      size: number;
      anchor: 'start' | 'middle' | 'end';
    }>;

export type SymbolPin = Readonly<{
  contact: string;
  pinId: string;
  end: Readonly<Vec2>;
  inner: Readonly<Vec2>;
}>;

export type SchematicSymbol = Readonly<{
  id: SymbolId;
  prims: readonly SymbolPrim[];
  pins: readonly SymbolPin[];
  bounds: Readonly<{ min: Readonly<Vec2>; max: Readonly<Vec2> }>;
  label: Readonly<Vec2>;
}>;
