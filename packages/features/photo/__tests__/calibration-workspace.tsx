import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { EngineProvider, useEngine, useSnapshot } from '@pcbk/client';
import type { ProjectService } from '@pcbk/contracts';
import { boardSurface, sceneTransformOf } from '@pcbk/domain/geometry';
import { Canvas, useSessionStore, useViewStore } from '@pcbk/ui';
import type { SceneTransform } from '@pcbk/ui';
import { useCalibrateStore } from '../ui/calibrate-store';
import { createPhotoUi } from '../ui';
import { photoUiFixture } from './ui-fixture';

type Matrix = [number, number, number, number, number, number];
const opened: ProjectService[] = [];

beforeEach(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open');
      },
    },
  });
});

afterEach(async () => {
  cleanup();
  for (const projects of opened.splice(0)) await projects.discard();
  useSessionStore.getState().reset('');
  useCalibrateStore.getState().reset();
  useViewStore.getState().reset();
  vi.restoreAllMocks();
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

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
  return attribute
    ? multiply(inherited, attribute.slice(7, -1).split(' ').map(Number) as Matrix)
    : inherited;
}

function installCtm(element: SVGElement) {
  // jsdom has no SVG layout; use the actual rendered scene and view ancestors.
  Object.defineProperty(element, 'getScreenCTM', {
    value: () => {
      const [a, b, c, d, e, f] = matrixOf(element);
      const determinant = a * d - b * c;
      return {
        inverse: () => ({
          a: d / determinant,
          b: -b / determinant,
          c: -c / determinant,
          d: a / determinant,
          e: (c * f - d * e) / determinant,
          f: (b * e - a * f) / determinant,
        }),
      };
    },
  });
}

export async function calibrationWorkspace({
  transform = 'none',
  withPhoto = true,
  withComponent = false,
}: {
  transform?: SceneTransform;
  withPhoto?: boolean;
  withComponent?: boolean;
} = {}) {
  const { engine, projects } = photoUiFixture();
  opened.push(projects);
  expect((await projects.create({ name: 'Kalibreerimise proov' })).ok).toBe(true);
  if (withPhoto) {
    expect(
      engine.execute('photo.add', {
        photo: {
          id: 'pho_calib',
          name: 'Foto',
          side: 'top',
          widthPx: 400,
          heightPx: 300,
          transform,
        },
      }).ok,
    ).toBe(true);
  }
  if (withComponent) {
    expect(
      engine.execute('components.add', {
        id: 'cmp_r1',
        kind: 'resistor',
        ref: 'R1',
        pins: [
          { id: '1', uid: 'pin_r1_1' },
          { id: '2', uid: 'pin_r1_2' },
        ],
        board: { footprint: 'chip', params: { size: '0805' }, center: { x: 125, y: 87 } },
      }).ok,
    ).toBe(true);
  }
  const execute = vi.spyOn(engine, 'execute');
  const module = createPhotoUi();
  const layers = module.canvasLayers ?? [];
  const tools = module.tools ?? [];
  const view = { zoom: 2, pan: { x: 20, y: 10 } };
  useSessionStore.getState().reset(engine.snapshot().sessionId);
  module.onSessionReset?.();

  function Workspace() {
    const snapshot = useSnapshot((snapshot) => snapshot);
    const currentEngine = useEngine();
    return (
      <>
        <Canvas
          layers={layers}
          tools={tools}
          snapshot={snapshot}
          execute={currentEngine.execute}
          sceneTransform={sceneTransformOf(snapshot.doc)}
          surface={boardSurface(snapshot.doc)}
          view={view}
          onViewChange={() => {}}
        />
        {module.topBar?.map((slot) => (
          <div key={slot.id}>{slot.render()}</div>
        ))}
        {module.bottomBar?.map((slot) => (
          <div key={slot.id}>{slot.render()}</div>
        ))}
      </>
    );
  }

  const app = render(
    <EngineProvider engine={engine} projects={projects}>
      <Workspace />
    </EngineProvider>,
  );
  const svg = app.container.querySelector('svg')!;
  const scene = svg.querySelector<SVGGElement>('[data-scene]')!;
  installCtm(svg);
  installCtm(scene);
  Object.defineProperties(svg, {
    setPointerCapture: { value() {} },
    hasPointerCapture: { value: () => false },
    getBoundingClientRect: {
      value: () => ({
        x: 17,
        y: 29,
        left: 17,
        top: 29,
        right: 817,
        bottom: 629,
        width: 800,
        height: 600,
      }),
    },
  });
  function click(x: number, y: number) {
    for (const type of ['pointerdown', 'pointerup']) {
      const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
      Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: 'mouse' } });
      fireEvent(svg, event);
    }
  }
  return {
    engine,
    execute,
    click,
    start: () => fireEvent.keyDown(window, { key: 'k' }),
    undo: () => act(() => expect(engine.undo().ok).toBe(true)),
  };
}
