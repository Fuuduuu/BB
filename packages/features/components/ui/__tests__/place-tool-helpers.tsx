import { act, fireEvent, render } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { vi } from 'vitest';
import { newBoardDoc } from '@pcbk/domain';
import { Canvas, useSessionStore } from '@pcbk/ui';
import type { SceneTransform, ToolApi } from '@pcbk/ui';
import { idGenerator, setup } from '../../../__tests__/helpers';
import { COMPONENTS_LAYERS } from '../layers';
import { createPlaceToolSpec } from '../PlaceTool';
import { placementKeys } from '../PlacementSection';
import { beginPlacement } from '../place-store';
import type { PlacementRequest } from '../place-store';

export const resistor = { mode: 'new', entryId: 'r_smd', params: { size: '0805' } } as const;
export const center = { x: 100, y: 80 };

export function mountPlaceTool(sceneTransform: SceneTransform = 'none') {
  const doc = newBoardDoc('Paigutuse proov');
  doc.scale.pxPerMm = 10;
  const { engine } = setup(doc);
  const tools = [createPlaceToolSpec(idGenerator())];
  const execute = vi.fn<ToolApi['execute']>((...args) => engine.execute(...args));
  const view = { zoom: 2, pan: { x: 0, y: 0 } };
  useSessionStore.getState().reset(engine.snapshot().sessionId);

  function Board() {
    const snapshot = useSyncExternalStore(engine.subscribe, engine.snapshot, engine.snapshot);
    return (
      <Canvas
        layers={COMPONENTS_LAYERS}
        tools={tools}
        keys={placementKeys}
        snapshot={snapshot}
        execute={execute}
        sceneTransform={sceneTransform}
        view={view}
        onViewChange={() => {}}
      />
    );
  }

  const { container } = render(<Board />);
  const svg = container.querySelector('svg')!;
  const scene = svg.querySelector('[data-scene]')!;
  Object.defineProperties(svg, {
    setPointerCapture: { value: () => {} },
    hasPointerCapture: { value: () => true },
    releasePointerCapture: { value: () => {} },
  });
  Object.defineProperty(scene, 'getScreenCTM', {
    value: () => ({ inverse: () => ({ a: 0.5, b: 0, c: 0, d: 0.5, e: 0, f: 0 }) }),
  });

  function pointer(type: string, x = 200, y = 160, button = 0) {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    fireEvent(svg, event);
  }

  function click(x = 200, y = 160) {
    pointer('pointerdown', x, y);
    pointer('pointerup', x, y);
  }

  function start(request: PlacementRequest = resistor) {
    act(() => beginPlacement(request));
  }

  return { engine, execute, svg, pointer, click, start };
}
