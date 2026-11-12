// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type { Vec2 } from '@pcbk/domain';
import { afterEach, expect, test, vi } from 'vitest';
import { snapshot } from '../../../client/src/__tests__/fakes';
import { useSessionStore } from '../shell/session-store';
import { Canvas, type CanvasProps } from './Canvas';
import { useSceneTransform } from './scene-text';
import { pointerWorld, type SceneTransform } from './stage';
import type { LayerSpec, ToolApi } from './tools';

type Matrix = [number, number, number, number, number, number];
const pixel = { x: 1234, y: 987 };
const surface = { width: 4000, height: 3000 };
const transforms: [SceneTransform, Vec2][] = [
  ['none', pixel],
  ['rot90', { x: 2013, y: 1234 }],
  ['rot180', { x: 2766, y: 2013 }],
  ['rot270', { x: 987, y: 2766 }],
  ['mirror', { x: 2766, y: 987 }],
  ['mirror_rot90', { x: 2013, y: 2766 }],
  ['mirror_rot180', { x: 1234, y: 2013 }],
  ['mirror_rot270', { x: 987, y: 1234 }],
];

afterEach(() => {
  cleanup();
  useSessionStore.getState().reset('');
});

function apply([a, b, c, d, e, f]: Matrix, { x, y }: Vec2): Vec2 {
  return { x: a * x + c * y + e, y: b * x + d * y + f };
}

function multiply(left: Matrix, right: Matrix): Matrix {
  const [a, b, c, d, e, f] = left;
  const [g, h, i, j, k, l] = right;
  return [
    a * g + c * h,
    b * g + d * h,
    a * i + c * j,
    b * i + d * j,
    a * k + c * l + e,
    b * k + d * l + f,
  ];
}

function matrixOf(element: Element): Matrix {
  const parent = element.parentElement;
  const inherited = parent?.closest('svg') ? matrixOf(parent) : ([1, 0, 0, 1, 17, 29] as Matrix);
  const attribute = element.getAttribute('transform');
  if (!attribute) return inherited;
  const own = attribute.slice(7, -1).split(' ').map(Number) as Matrix;
  return multiply(inherited, own);
}

function installCtm(element: SVGElement): void {
  // jsdom has no SVG layout; derive the full CTM from the real rendered ancestor groups.
  Object.defineProperty(element, 'getScreenCTM', {
    value: () => {
      const [a, b, c, d, e, f] = matrixOf(element);
      const det = a * d - b * c;
      return {
        inverse: () => ({
          a: d / det,
          b: -b / det,
          c: -c / det,
          d: a / det,
          e: (c * f - d * e) / det,
          f: (b * e - a * f) / det,
        }),
      };
    },
  });
}

function setup(overrides: Partial<CanvasProps>) {
  const props: CanvasProps = {
    layers: [],
    tools: [],
    sceneTransform: 'none',
    surface,
    view: { zoom: 2.5, pan: { x: 101, y: 57 } },
    onViewChange() {},
    snapshot: snapshot(),
    execute: () => ({ ok: true, value: { rev: 1 } }),
    ...overrides,
  };
  useSessionStore.getState().reset(props.snapshot.sessionId);
  const result = render(<Canvas {...props} />);
  const svg = result.container.querySelector('svg')!;
  const scene = svg.querySelector<SVGGElement>('[data-scene]')!;
  installCtm(scene);
  Object.defineProperties(svg, {
    setPointerCapture: { value() {} },
    hasPointerCapture: { value: () => false },
  });
  return {
    svg,
    scene,
    props,
    update(next: Partial<CanvasProps>) {
      Object.assign(props, next);
      result.rerender(<Canvas {...props} />);
    },
  };
}

test.each(transforms)('pins_stay_on_photo_under_all_8_transforms (%s)', (transform, expected) => {
  const pin = { kind: 'pin', id: '1', componentId: 'cmp_photo' };
  const layers: LayerSpec[] = [
    {
      id: 'photo',
      z: 0,
      render: () => <image href="test-photo" x={0} y={0} width={4000} height={3000} />,
    },
    {
      id: 'pins',
      z: 1,
      render: () => <circle cx={pixel.x} cy={pixel.y} r={1} />,
      hits: () => [{ ...pin, shape: { type: 'point', at: pixel, r: 1 } }],
    },
  ];
  const { svg, scene } = setup({ layers, sceneTransform: transform });
  const photo = svg.querySelector('image')!;
  const pad = svg.querySelector('circle')!;
  const screen = { x: expected.x * 2.5 + 118, y: expected.y * 2.5 + 86 };

  expect(photo.closest('[data-scene]')).toBe(scene);
  expect(pad.closest('[data-scene]')).toBe(scene);
  expect(apply(matrixOf(photo), pixel)).toEqual(screen);
  expect(
    apply(matrixOf(pad), { x: Number(pad.getAttribute('cx')), y: Number(pad.getAttribute('cy')) }),
  ).toEqual(screen);
  const world = pointerWorld(scene, screen);
  expect(world.x).toBeCloseTo(pixel.x);
  expect(world.y).toBeCloseTo(pixel.y);
  for (const type of ['pointerdown', 'pointerup']) {
    const event = new MouseEvent(type, { bubbles: true, clientX: screen.x, clientY: screen.y });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    fireEvent(svg, event);
  }
  expect(useSessionStore.getState().selection).toEqual({ items: [pin] });
});

test.each(transforms)(
  'arrow_key_nudges_follow_screen_axes_under_all_8_transforms (%s)',
  (transform) => {
    const execute = vi.fn<CanvasProps['execute']>(() => ({ ok: true, value: { rev: 1 } }));
    const { svg, scene, props } = setup({ sceneTransform: transform, execute });
    const component = { kind: 'component', id: 'cmp_nudge' };
    act(() => useSessionStore.getState().setSelection({ items: [component] }));
    const before = apply(matrixOf(scene), pixel);
    const directions = [
      ['ArrowRight', 1, 0],
      ['ArrowLeft', -1, 0],
      ['ArrowUp', 0, -1],
      ['ArrowDown', 0, 1],
    ] as const;
    for (const shiftKey of [false, true]) {
      for (const [key, x, y] of directions) {
        execute.mockClear();
        fireEvent.keyDown(svg, { key, shiftKey });
        expect(execute).toHaveBeenCalledExactlyOnceWith(
          'items.translate',
          expect.objectContaining({
            items: [component],
          }),
        );
        const { dx, dy } = execute.mock.lastCall![1] as { dx: number; dy: number };
        const after = apply(matrixOf(scene), { x: pixel.x + dx, y: pixel.y + dy });
        const step = (shiftKey ? 10 : 1) * props.view.zoom;
        expect(after.x - before.x).toBeCloseTo(x * step);
        expect(after.y - before.y).toBeCloseTo(y * step);
      }
    }
    execute.mockClear();
    for (const modifier of ['repeat', 'altKey', 'ctrlKey', 'metaKey']) {
      fireEvent.keyDown(svg, { key: 'ArrowRight', [modifier]: true });
    }
    expect(execute).not.toHaveBeenCalled();
  },
);

test('transform_only_change_rebuilds_hits_and_updates_tool_api', () => {
  const hits = vi.fn<NonNullable<LayerSpec['hits']>>((_snapshot, _zoom, transform) => [
    {
      kind: 'component',
      id: transform,
      shape: { type: 'point', at: { x: transform === 'mirror' ? 50 : 10, y: 20 }, r: 1 },
    },
  ]);
  const captured: ToolApi[] = [];
  const { svg, props, update } = setup({
    layers: [{ id: 'dynamic', z: 1, render: () => null, hits }],
    keys: [
      {
        id: 'inspect',
        key: 'I',
        run(api) {
          captured.push(api);
          return true;
        },
      },
    ],
  });
  fireEvent.keyDown(svg, { key: 'i' });
  let api = captured[0]!;
  expect(api.sceneTransform()).toBe('none');
  expect(api.hitIndex.query({ x: 10, y: 20 }, 1)?.id).toBe('none');
  expect(hits).toHaveBeenLastCalledWith(props.snapshot, 2.5, 'none');

  update({ sceneTransform: 'mirror' });
  fireEvent.keyDown(svg, { key: 'i' });
  api = captured[1]!;
  expect(api.sceneTransform()).toBe('mirror');
  expect(api.hitIndex.query({ x: 50, y: 20 }, 1)?.id).toBe('mirror');
  expect(api.hitIndex.query({ x: 10, y: 20 }, 1)).toBeUndefined();
  expect(hits).toHaveBeenCalledTimes(2);
  expect(hits).toHaveBeenLastCalledWith(props.snapshot, 2.5, 'mirror');
  update({ sceneTransform: 'mirror' });
  expect(hits).toHaveBeenCalledTimes(2);
});

test('layer_hook_reads_current_transform_through_memoized_layers', () => {
  function Orientation() {
    return <text>{useSceneTransform()}</text>;
  }
  const { svg, update } = setup({
    layers: [{ id: 'orientation', z: 1, render: () => <Orientation /> }],
  });
  for (const [sceneTransform] of transforms) {
    update({ sceneTransform });
    expect(svg.querySelector('text')?.textContent).toBe(sceneTransform);
  }
});

test('tool_overlay_reads_current_transform_during_transform_only_render', () => {
  const { svg, update } = setup({
    tools: [
      {
        id: 'orientation',
        label: 'Orientation',
        key: 'T',
        icon: '',
        group: 'draw',
        create: () => ({
          id: 'orientation',
          cursor: 'crosshair',
          onPointerDown() {},
          onPointerMove() {},
          onPointerUp() {},
          overlay: (api) => <text>{api.sceneTransform()}</text>,
        }),
      },
    ],
  });
  fireEvent.keyDown(svg, { key: 't' });
  expect(svg.querySelector('text')?.textContent).toBe('none');
  update({ sceneTransform: 'mirror' });
  expect(svg.querySelector('text')?.textContent).toBe('mirror');
});
