import { cleanup, fireEvent, render } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { Fragment, useMemo, useSyncExternalStore } from 'react';
import { newBoardDoc } from '@pcbk/domain';
import type { BoardPlacement } from '@pcbk/domain';
import { Canvas, UiRegistry, useSessionStore, useViewStore } from '@pcbk/ui';
import type { SceneTransform, ToolApi } from '@pcbk/ui';
import { idGenerator, setup } from '../../../__tests__/helpers';
import { createComponentsUi } from '..';

export const id = 'cmp_r1';
const center = { x: 100, y: 80 };

export function reset() {
  cleanup();
  useSessionStore.getState().reset('');
  useViewStore.getState().setBoardView({ zoom: 1, pan: { x: 0, y: 0 } });
}

export function mount(
  placement: Partial<BoardPlacement> = {},
  zoom = 1,
  sceneTransform: SceneTransform = 'none',
  calibrated = true,
  pxPerMm = 10,
) {
  const doc = newBoardDoc('Plaadi proov');
  doc.scale.pxPerMm = pxPerMm;
  doc.scale.calibrated = calibrated;
  doc.components.push({
    id,
    ref: 'R1',
    kind: 'resistor',
    marking: '',
    value: '100R',
    identified: true,
    dnp: false,
    note: '',
    pins: [
      { id: '1', uid: 'pin_r1_1', nc: false },
      { id: '2', uid: 'pin_r1_2', nc: false },
    ],
    board: {
      center,
      footprint: 'chip',
      params: { size: '0805' },
      rotationDeg: 0,
      side: 'top',
      scaleX: 1,
      scaleY: 1,
      customPads: {},
      ...placement,
    },
  });
  const { engine } = setup(doc);
  const registry = new UiRegistry([createComponentsUi(idGenerator())]);
  const layers = registry.canvasLayers();
  const tools = registry.tools();
  const bottomBar = registry.bottomBar();
  const execute = vi.fn<ToolApi['execute']>((...args) => engine.execute(...args));
  const view = { zoom, pan: { x: 0, y: 0 } };
  useSessionStore.getState().reset(engine.snapshot().sessionId);
  useViewStore.getState().setBoardView(view);
  function Board() {
    const snapshot = useSyncExternalStore(engine.subscribe, engine.snapshot, engine.snapshot);
    const selection = useSessionStore((state) => state.selection);
    const currentLayers = useMemo(() => registry.canvasLayers(), [selection]);
    return (
      <>
        <Canvas
          layers={currentLayers}
          tools={tools}
          sceneTransform={sceneTransform}
          view={view}
          onViewChange={() => {}}
          snapshot={snapshot}
          execute={execute}
        />
        {bottomBar.map(({ id, render }) => (
          <Fragment key={id}>{render()}</Fragment>
        ))}
      </>
    );
  }
  const rendered = render(<Board />);
  const svg = rendered.container.querySelector('svg')!;
  const scene = svg.querySelector('[data-scene]')!;
  Object.defineProperties(svg, {
    setPointerCapture: { value: vi.fn() },
    hasPointerCapture: { value: () => true },
    releasePointerCapture: { value: vi.fn() },
  });
  Object.defineProperty(scene, 'getScreenCTM', {
    value: () => ({ inverse: () => ({ a: 1 / zoom, b: 0, c: 0, d: 1 / zoom, e: 0, f: 0 }) }),
  });
  return { ...rendered, svg, engine, execute, layers, registry };
}

export function pointer(svg: SVGSVGElement, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  fireEvent(svg, event);
}

export function click(svg: SVGSVGElement, x: number, y: number) {
  pointer(svg, 'pointerdown', x, y);
  pointer(svg, 'pointerup', x, y);
}

export function beginAlignment(svg: SVGSVGElement, zoom = 1) {
  fireEvent.keyDown(window, { key: 'a' });
  expect(useSessionStore.getState().toolId).toBe('components.align');
  click(svg, 90 * zoom, 80 * zoom);
  click(svg, 180 * zoom, 120 * zoom);
}
