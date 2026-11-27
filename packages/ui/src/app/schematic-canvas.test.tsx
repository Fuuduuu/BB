// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import { DEFAULT_VIEW_STATE, ok } from '@pcbk/contracts';
import type { AppHost, ProjectService } from '@pcbk/contracts';
import { FakeEngine, FakeProjects, snapshot } from '../../../client/src/__tests__/fakes';
import { useViewStore } from '../shell/view-store';
import type { UiModule } from '../shell/UiRegistry';
import { Workbench } from './Workbench';
import { idGenerator, setupWithAllFeatures } from '../../../features/__tests__/helpers';
import { measurementDoc, pointer } from '../../../features/measurements/__tests__/workspace';
import { uiFeatures } from '../../../features/ui';
import { useSessionStore } from '../shell/session-store';
import { UiRegistry } from '../shell/UiRegistry';
import { SchematicCanvas } from './SchematicCanvas';

afterEach(() => {
  cleanup();
  useViewStore.getState().reset();
  vi.unstubAllGlobals();
});

const boardLayers: UiModule = {
  id: 'test-board-layers',
  title: 'Katseplaat',
  canvasLayers: [
    {
      id: 'test-photo',
      z: 0,
      render: ({ snapshot: { doc } }) =>
        doc.photos.map((photo) => (
          <image key={photo.id} width={photo.widthPx} height={photo.heightPx} />
        )),
    },
    {
      id: 'test-component',
      z: 1,
      render: ({ snapshot: { doc } }) =>
        doc.components.map(({ id, ref }) => (
          <text key={id} data-board-component="">
            {ref}
          </text>
        )),
    },
  ],
};

test('schematic_canvas_reuses_canvas_with_own_view', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  const initial = snapshot();
  const engine = new FakeEngine({
    ...initial,
    doc: {
      ...initial.doc,
      photos: [
        {
          id: 'pho_test',
          side: 'top',
          name: 'Sünteetiline foto',
          widthPx: 400,
          heightPx: 300,
          transform: 'none',
        },
      ],
      components: [
        {
          id: 'cmp_r1',
          ref: 'R1',
          kind: 'resistor',
          marking: '',
          value: '',
          identified: false,
          dnp: false,
          note: '',
          pins: [
            { id: '1', uid: 'pin_r1_1', nc: false },
            { id: '2', uid: 'pin_r1_2', nc: false },
          ],
          board: {
            footprint: 'chip',
            params: { size: '0805' },
            center: { x: 45, y: 30 },
            side: 'top',
            rotationDeg: 0,
            scaleX: 1,
            scaleY: 1,
            customPads: {},
          },
        },
      ],
    },
  });
  const projects: ProjectService = new FakeProjects();
  vi.spyOn(projects, 'open').mockResolvedValue(
    ok({
      projectId: 'test',
      fileId: 'file',
      sessionId: initial.sessionId,
      name: 'Katseplaat',
      path: 'test',
      readOnly: false,
      view: { ...DEFAULT_VIEW_STATE, boardView: { zoom: 2, pan: { x: -30, y: 25 } } },
    }),
  );
  const host = {
    kind: 'web',
    recents: async () => [],
    removeRecent: async () => {},
    onCloseRequested: () => () => {},
    onOpenPath: vi.fn<AppHost['onOpenPath']>(() => () => {}),
    closeNow() {},
    reload() {},
    saveDiagnostics: async () => {},
  } satisfies AppHost;
  const { container } = render(
    <EngineProvider engine={engine} projects={projects}>
      <Workbench host={host} uiModules={() => [boardLayers]} />
    </EngineProvider>,
  );
  await act(async () => host.onOpenPath.mock.lastCall![0]('test'));
  expect(container.querySelector('svg image')).not.toBeNull();
  expect(container.querySelector('[data-board-component]')?.textContent).toBe('R1');

  const { fitRequest, boardView } = useViewStore.getState();
  act(() => useViewStore.setState({ activeView: 'schematic', schematicView: null }));
  const hint = screen.getByText('Skeemil pole veel komponente.');
  expect(hint.matches('p.pcbk-canvas-hint')).toBe(true);
  expect(screen.queryByRole('status')).not.toBe(hint);
  expect(useViewStore.getState().fitRequest).toBeGreaterThan(fitRequest);

  const svg = container.querySelector('svg[tabindex]')!;
  expect(svg.querySelector('[data-view] > [data-scene]')).not.toBeNull();
  expect(svg.querySelector('[data-scene] > rect[width="420"][height="297"]')).not.toBeNull();
  expect(svg.querySelector('image')).toBeNull();
  expect(svg.querySelector('[data-board-component]')).toBeNull();

  Object.defineProperties(svg.parentElement!, {
    getBoundingClientRect: {
      value: () => ({ left: 10, top: 15, right: 810, bottom: 615, width: 800, height: 600 }),
    },
    clientWidth: { value: 800 },
    clientHeight: { value: 600 },
  });
  fireEvent(window, new Event('resize'));
  act(() => useViewStore.getState().setSchematicView({ zoom: 1, pan: { x: 0, y: 0 } }));
  await waitFor(() => expect(svg.querySelector('pattern[width="2.54"]')).toBeNull());
  expect(svg.querySelector('pattern[width="25.4"][height="25.4"]')).not.toBeNull();

  fireEvent.wheel(svg, { clientX: 210, clientY: 115, deltaY: -Math.log(4) / 0.002 });
  expect(useViewStore.getState().schematicView?.zoom).toBeCloseTo(4);
  expect(useViewStore.getState().boardView).toBe(boardView);
  await waitFor(() => {
    expect(svg.querySelector('pattern[width="2.54"][height="2.54"]')).not.toBeNull();
  });
});

test('schematic_canvas_moves_frames_and_deletes', () => {
  const doc = measurementDoc();
  const original = doc.components[0]!;
  const placed = (id: string, ref: string, x: number, y: number) => ({
    ...original,
    id,
    ref,
    pins: original.pins.map((pin) => ({ ...pin, uid: `pin_${id}_${pin.id}` })),
    schematic: { symbol: 'box', at: { x, y }, rot: 0 as const, mirror: false },
  });
  doc.components = [
    placed('cmp_u1', 'U1', 50.8, 50.8),
    placed('cmp_u2', 'U2', 76.2, 101.6),
    placed('cmp_u3', 'U3', 91.44, 101.6),
  ];
  const { engine, host } = setupWithAllFeatures(doc);
  const execute = vi.spyOn(engine, 'execute');
  useSessionStore.getState().reset(engine.snapshot().sessionId);
  useViewStore.getState().setActiveView('schematic');
  useViewStore.getState().setSchematicView({ zoom: 1, pan: { x: 0, y: 0 } });
  const registry = new UiRegistry(uiFeatures(idGenerator(), () => {}));
  const { container } = render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      <SchematicCanvas registry={registry} />
    </EngineProvider>,
  );
  const scene = container.querySelector('[data-scene]')!;
  const svg = scene.closest('svg')!;
  Object.defineProperty(scene, 'getScreenCTM', {
    value: () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }),
  });
  Object.defineProperties(svg, {
    setPointerCapture: { value() {} },
    hasPointerCapture: { value: () => false },
  });
  const component = () => engine.snapshot().doc.components[0]!;
  const label = () =>
    [...svg.querySelectorAll('[data-component="cmp_u1"] text')].find(
      (text) => text.textContent === 'U1',
    )!;
  const originalLabelY = Number(label().getAttribute('y'));

  pointer(svg, 'pointerdown', 50.8, 50.8);
  pointer(svg, 'pointermove', 57, 57.8);
  const translation = label().parentElement?.getAttribute('transform');
  const [, dx, dy] = translation?.match(/^translate\(([^ ]+) ([^ ]+)\)$/) ?? [];
  expect(Number(label().getAttribute('x')) + Number(dx)).toBeCloseTo(55.88);
  expect(Number(label().getAttribute('y')) + Number(dy)).toBeCloseTo(originalLabelY + 7.62);
  expect(component().schematic?.at).toEqual({ x: 50.8, y: 50.8 });
  expect(host.drainJournal()).toEqual([]);
  pointer(svg, 'pointerup', 57, 57.8);
  expect(execute).toHaveBeenCalledExactlyOnceWith(
    'items.translate',
    expect.objectContaining({
      items: [{ kind: 'component', id: 'cmp_u1' }],
      view: 'schematic',
    }),
  );
  expect(component().schematic?.at.x).toBeCloseTo(55.88);
  expect(component().schematic?.at.y).toBeCloseTo(58.42);
  expect(component().board).toEqual(original.board);

  fireEvent.keyDown(svg, { key: 'ArrowRight' });
  expect(component().schematic?.at.x).toBeCloseTo(58.42);
  fireEvent.keyDown(svg, { key: 'ArrowDown', shiftKey: true });
  expect(component().schematic?.at.y).toBeCloseTo(83.82);
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual([
    'items.translate',
    'items.translate',
    'items.translate',
  ]);

  pointer(svg, 'pointerdown', 35, 65);
  pointer(svg, 'pointermove', 92.5, 113);
  pointer(svg, 'pointerup', 92.5, 113);
  expect(useSessionStore.getState().selection.items).toEqual([
    { kind: 'component', id: 'cmp_u1' },
    { kind: 'component', id: 'cmp_u2' },
  ]);
  fireEvent.keyDown(svg, { key: 'Delete' });
  expect(host.drainJournal().map(({ commandId }) => commandId)).toEqual(['items.delete']);
  expect(engine.snapshot().doc.components.map(({ id }) => id)).toEqual(['cmp_u3']);
  act(() => {
    expect(engine.undo().ok).toBe(true);
  });
  expect(component().board).toEqual(original.board);
  expect(component().schematic?.at.x).toBeCloseTo(58.42);
  expect(component().schematic?.at.y).toBeCloseTo(83.82);
});
