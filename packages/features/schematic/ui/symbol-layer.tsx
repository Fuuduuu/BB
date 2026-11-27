import type { Snapshot } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import {
  schematicSymbol,
  symbolToSchematic,
  SCHEMATIC_GRID_MM,
  snapToSchematicGrid,
} from '@pcbk/domain/schematic';
import type { SymbolId, SymbolPin, SymbolPrim } from '@pcbk/domain/schematic';
import { monoLabelHalf, useSessionStore } from '@pcbk/ui';
import type { HitItem, LayerSpec, TranslatePreviewData } from '@pcbk/ui';

type Component = Snapshot['doc']['components'][number];
type DrawnSymbol = {
  id: SymbolId;
  prims: readonly SymbolPrim[];
  pins: readonly SymbolPin[];
  body: Vec2[];
  label: Vec2;
  textRotation: 0 | 90;
};

const symbolCache = new WeakMap<Component, DrawnSymbol | null>();
const stroke = { stroke: 'currentColor', strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke' };

function drawnSymbol(component: Component): DrawnSymbol | null {
  const cached = symbolCache.get(component);
  if (cached !== undefined) return cached;
  const placement = component.schematic;
  const symbol = placement && schematicSymbol(component);
  if (!placement || !symbol) {
    symbolCache.set(component, null);
    return null;
  }

  const at = (local: Vec2) => symbolToSchematic(placement, local);
  const { min, max } = symbol.bounds;
  const label = at(symbol.label);
  const offset = placement.labelOffset;
  // Keep glyphs unmirrored while their text starts in the same local direction.
  const reverseAnchor = placement.mirror !== placement.rot >= 180;
  const textRotation = placement.rot === 90 || placement.rot === 270 ? 90 : 0;
  const geometry: DrawnSymbol = {
    id: symbol.id,
    prims: symbol.prims.map((shape) => {
      if (shape.kind === 'line') return { ...shape, points: shape.points.map(at) };
      if (shape.kind !== 'text' || !reverseAnchor || shape.anchor === 'middle') {
        return { ...shape, at: at(shape.at) };
      }
      return { ...shape, at: at(shape.at), anchor: shape.anchor === 'start' ? 'end' : 'start' };
    }),
    pins: symbol.pins.map((pin) => ({ ...pin, end: at(pin.end), inner: at(pin.inner) })),
    body: [min, { x: max.x, y: min.y }, max, { x: min.x, y: max.y }].map(at),
    label: { x: label.x + (offset?.x ?? 0), y: label.y + (offset?.y ?? 0) },
    textRotation,
  };
  symbolCache.set(component, geometry);
  return geometry;
}

function SymbolPrimitive({ shape, textRotation }: { shape: SymbolPrim; textRotation: number }) {
  switch (shape.kind) {
    case 'line': {
      const Element = shape.closed ? 'polygon' : 'polyline';
      return (
        <Element
          points={shape.points.map(({ x, y }) => `${x},${y}`).join(' ')}
          fill={shape.fill ? 'currentColor' : 'none'}
          {...stroke}
        />
      );
    }
    case 'circle':
      return (
        <circle
          cx={shape.at.x}
          cy={shape.at.y}
          r={shape.r}
          fill={shape.fill ? 'currentColor' : 'none'}
          {...stroke}
        />
      );
    case 'text':
      return (
        <text
          x={shape.at.x}
          y={shape.at.y}
          textAnchor={shape.anchor}
          transform={`rotate(${textRotation} ${shape.at.x} ${shape.at.y})`}
          dominantBaseline="central"
          fontSize={shape.size}
          fill="currentColor"
        >
          {shape.text}
        </text>
      );
  }
}

function SchematicSymbols({
  snapshot,
  preview,
}: Pick<Parameters<LayerSpec['render']>[0], 'snapshot' | 'preview'>) {
  const translation = preview?.owner === 'select' ? (preview.data as TranslatePreviewData) : null;
  const moved = new Set(
    translation?.items.filter(({ kind }) => kind === 'component').map(({ id }) => id),
  );
  const selection = useSessionStore((state) => state.selection);
  const selected = new Set(
    selection.items.filter(({ kind }) => kind === 'component').map(({ id }) => id),
  );

  return (
    <g data-layer="schematic.symbols" pointerEvents="none" fontFamily="var(--f-mono)">
      {snapshot.doc.components.map((component) => {
        const symbol = drawnSymbol(component);
        if (!symbol) return null;
        const isSelected = selected.has(component.id);
        const at = component.schematic?.at;
        const previewAt =
          at && translation && moved.has(component.id)
            ? snapToSchematicGrid({ x: at.x + translation.dx, y: at.y + translation.dy })
            : undefined;
        const transform =
          at && previewAt ? `translate(${previewAt.x - at.x} ${previewAt.y - at.y})` : undefined;
        return (
          <g
            key={component.id}
            data-component={component.id}
            data-symbol={symbol.id}
            data-selected={isSelected ? 'true' : undefined}
            transform={transform}
            color={isSelected ? 'var(--accent)' : 'var(--ink)'}
          >
            {symbol.prims.map((shape, index) => (
              <SymbolPrimitive key={index} shape={shape} textRotation={symbol.textRotation} />
            ))}
            {symbol.pins.map(({ pinId, end, inner }) => (
              <line
                key={pinId}
                data-pin={pinId}
                x1={end.x}
                y1={end.y}
                x2={inner.x}
                y2={inner.y}
                {...stroke}
              />
            ))}
            <text
              x={symbol.label.x}
              y={symbol.label.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={SCHEMATIC_GRID_MM}
              fill="currentColor"
            >
              {component.ref}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export const symbolLayer: LayerSpec = {
  id: 'schematic.symbols',
  z: 10,
  previewOwners: ['select'],
  render: ({ snapshot, preview }) => <SchematicSymbols snapshot={snapshot} preview={preview} />,
  hits: (snapshot, zoom) => {
    const hits: HitItem[] = [];
    for (const component of snapshot.doc.components) {
      const geometry = drawnSymbol(component);
      if (!geometry) continue;
      hits.push(
        {
          kind: 'component',
          id: component.id,
          priority: 0,
          shape: { type: 'area', polygon: geometry.body },
        },
        {
          kind: 'component',
          id: component.id,
          priority: 1,
          shape: {
            type: 'rect',
            at: geometry.label,
            half: monoLabelHalf(component.ref, SCHEMATIC_GRID_MM, zoom, 0),
            angleDeg: 0,
          },
        },
      );
      for (const { pinId, end } of geometry.pins) {
        hits.push({
          kind: 'pin',
          id: pinId,
          componentId: component.id,
          priority: 2,
          shape: { type: 'point', at: end, r: 1 },
        });
      }
    }
    return hits;
  },
};
