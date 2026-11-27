import { useLayoutEffect, useMemo } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import { normalizeBoardView } from '@pcbk/contracts';
import { Canvas } from '../canvas/Canvas';
import type { LayerSpec } from '../canvas/tools';
import type { UiRegistry } from '../shell/UiRegistry';
import { et } from '../shell/i18n/et';
import { useViewStore } from '../shell/view-store';

const surface = { width: 420, height: 297 };
const defaultView = normalizeBoardView(undefined);
const gridStepMm = 2.54;

function GridLines({ id, step, stroke }: { id: string; step: number; stroke: string }) {
  return (
    <>
      <defs>
        <pattern id={id} width={step} height={step} patternUnits="userSpaceOnUse">
          <path
            d={`M ${step} 0 H 0 V ${step}`}
            fill="none"
            stroke={stroke}
            vectorEffect="non-scaling-stroke"
          />
        </pattern>
      </defs>
      <rect width={surface.width} height={surface.height} fill={`url(#${id})`} />
    </>
  );
}

const grid: LayerSpec = {
  id: 'schematic.grid',
  z: 0,
  render: ({ zoom }) => (
    <g pointerEvents="none" aria-hidden="true">
      {gridStepMm * zoom >= 6 && (
        <GridLines id="pcbk-schematic-grid-fine" step={gridStepMm} stroke="var(--line)" />
      )}
      <GridLines id="pcbk-schematic-grid-major" step={25.4} stroke="var(--line-2)" />
    </g>
  ),
};

export function SchematicCanvas({ registry }: { registry: UiRegistry }) {
  const engine = useEngine();
  const snapshot = useSnapshot((current) => current);
  const execute = useMemo(() => engine.execute.bind(engine), [engine]);
  const layers = useMemo(() => [grid, ...registry.schematicLayers()], [registry]);
  const tools = useMemo(() => registry.schematicTools(), [registry]);
  const keys = useMemo(() => registry.schematicKeys(), [registry]);
  const contextMenu = useMemo(() => registry.schematicContextMenu.bind(registry), [registry]);
  const moveRefs = useMemo(() => registry.schematicMoveRefs.bind(registry), [registry]);
  const itemsInFrame = useMemo(() => registry.schematicItemsInFrame.bind(registry), [registry]);
  const deleteIds = useMemo(() => registry.deleteIds.bind(registry), [registry]);
  const view = useViewStore((state) => state.schematicView);
  const setView = useViewStore((state) => state.setSchematicView);
  const right = useViewStore((state) => (state.contextShown ? state.contextWidth : 0));
  const fitInsets = useMemo(() => ({ right }), [right]);

  useLayoutEffect(() => {
    const { schematicView, requestFit } = useViewStore.getState();
    if (schematicView === null) requestFit();
  }, []);

  return (
    <div className="pcbk-schematic-canvas">
      <Canvas
        layers={layers}
        tools={tools}
        keys={keys}
        contextMenu={contextMenu}
        moveRefs={moveRefs}
        itemsInFrame={itemsInFrame}
        deleteIds={deleteIds}
        space="schematic"
        sceneTransform="none"
        surface={surface}
        view={view ?? defaultView}
        onViewChange={setView}
        snapshot={snapshot}
        execute={execute}
        fitInsets={fitInsets}
      />
      {!snapshot.doc.components.some((component) => component.schematic) && (
        <p className="pcbk-canvas-hint">{et.shell.schematicEmpty}</p>
      )}
    </div>
  );
}
