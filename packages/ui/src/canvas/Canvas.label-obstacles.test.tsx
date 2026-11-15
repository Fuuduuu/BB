// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { snapshot } from '../../../client/src/__tests__/fakes';
import { useSessionStore } from '../shell/session-store';
import { Canvas } from './Canvas';
import type { CanvasProps } from './Canvas';
import * as canvas from './index';
import type { LayerSpec } from './tools';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useSessionStore.getState().reset('');
});

test('label_obstacles_recomputed_only_on_input_change', () => {
  vi.useFakeTimers();
  const observed: unknown[] = [];
  function Probe() {
    observed.push(canvas.useLabelObstacles());
    return null;
  }
  const obstacles = vi.fn<NonNullable<LayerSpec['obstacles']>>((current, zoom) => [
    {
      owner: 'test.label',
      componentId: 'cmp_test',
      center: { x: current.rev, y: zoom },
      half: { x: 5, y: 2 },
    },
  ]);
  const hits = vi.fn<NonNullable<LayerSpec['hits']>>(() => []);
  const layer: LayerSpec = { id: 'labels', z: 0, render: () => <Probe />, obstacles, hits };
  let props: CanvasProps = {
    layers: [layer, { id: 'no-obstacles', z: 1, render: () => null }],
    tools: [],
    sceneTransform: 'none',
    view: { zoom: 1, pan: { x: 0, y: 0 } },
    onViewChange: vi.fn(),
    snapshot: snapshot(),
    execute: vi.fn(() => ({ ok: true as const, value: { rev: 1 } })),
  };
  const result = render(<Canvas {...props} />);
  function update(next: Partial<CanvasProps>) {
    props = { ...props, ...next };
    result.rerender(<Canvas {...props} />);
  }
  const expectInputs = (count: number, zoom = 1) => {
    expect(obstacles).toHaveBeenCalledTimes(count);
    expect(hits).toHaveBeenCalledTimes(count);
    expect(obstacles.mock.lastCall).toEqual([props.snapshot, zoom, props.sceneTransform]);
    expect(observed.at(-1)).toEqual(obstacles.mock.results.at(-1)?.value);
  };

  expectInputs(1);
  const initial = observed[0];
  expect(initial).toEqual([
    { owner: 'test.label', componentId: 'cmp_test', center: { x: 0, y: 1 }, half: { x: 5, y: 2 } },
  ]);
  act(() => useSessionStore.getState().setPreview({ owner: 'test', data: { dx: 3 } }));
  expectInputs(1);
  expect(observed.at(-1)).toBe(initial);
  update({ view: { zoom: 1, pan: { x: 20, y: 30 } }, snapshot: snapshot() });
  expectInputs(1);

  update({ snapshot: snapshot('session-a', 1) });
  expectInputs(2);
  expect(observed.at(-1)).toEqual([
    { owner: 'test.label', componentId: 'cmp_test', center: { x: 1, y: 1 }, half: { x: 5, y: 2 } },
  ]);
  update({ snapshot: snapshot('session-b', 1) });
  expectInputs(3);
  update({ sceneTransform: 'mirror_rot90' });
  expectInputs(4);
  update({ layers: [...props.layers] });
  expectInputs(5);
  update({ view: { zoom: 2, pan: { x: 20, y: 30 } } });
  expectInputs(5);
  act(() => vi.advanceTimersByTime(120));
  act(() => vi.advanceTimersToNextFrame());
  expectInputs(6, 2);
});
