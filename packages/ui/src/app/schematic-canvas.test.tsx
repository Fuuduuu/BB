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
