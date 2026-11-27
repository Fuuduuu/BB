// @vitest-environment jsdom
import { EngineProvider } from '@pcbk/client';
import { DEFAULT_VIEW_STATE, ok } from '@pcbk/contracts';
import type { AppHost, ProjectService } from '@pcbk/contracts';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { FakeEngine, FakeProjects, snapshot } from '../../../client/src/__tests__/fakes';
import { Workbench } from '../app/Workbench';
import { useCursorStore } from '../canvas/cursor-store';
import { bindPanelKeys } from './keymap';
import { useSessionStore } from './session-store';
import type { UiModule } from './UiRegistry';
import { ViewControls } from './ViewControls';
import { useViewStore } from './view-store';

afterEach(() => {
  cleanup();
  useViewStore.getState().reset();
  useCursorStore.setState({ world: null });
});

function pressTab(target: EventTarget, modifiers: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event.defaultPrevented;
}

test('view_switch_key_and_controls_follow_active_view', () => {
  const initial = snapshot();
  const engine = new FakeEngine({
    ...initial,
    doc: { ...initial.doc, scale: { ...initial.doc.scale, pxPerMm: 10 } },
  });
  useViewStore.setState({
    activeView: 'board',
    boardView: { zoom: 2, pan: { x: 0, y: 0 } },
    schematicView: { zoom: 3.7795, pan: { x: 0, y: 0 } },
  });
  useCursorStore.setState({ world: { x: 25.4, y: 12.7 } });
  render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      <ViewControls />
      <input aria-label="Tekstiväli" />
      <dialog open>
        <button type="button">Dialoogi toiming</button>
      </dialog>
    </EngineProvider>,
  );

  const release = bindPanelKeys(window, { navigator: vi.fn(), context: vi.fn() });
  try {
    expect(screen.getByText('200 %')).toBeTruthy();
    expect(pressTab(document.body)).toBe(false);

    const input = screen.getByRole('textbox', { name: 'Tekstiväli' });
    input.focus();
    expect(pressTab(input, { ctrlKey: true })).toBe(false);

    const dialogButton = screen.getByRole('button', { name: 'Dialoogi toiming' });
    dialogButton.focus();
    expect(pressTab(dialogButton, { ctrlKey: true })).toBe(false);
    expect(useViewStore.getState().activeView).toBe('board');
    dialogButton.blur();
    screen.getByRole('dialog').removeAttribute('open');

    expect(pressTab(document.body, { ctrlKey: true })).toBe(true);
    expect(useViewStore.getState().activeView).toBe('schematic');
    expect(screen.getByText('100 %')).toBeTruthy();
    expect(screen.getByText('X 25,4 mm · Y 12,7 mm')).toBeTruthy();

    expect(pressTab(document.body, { ctrlKey: true, shiftKey: true })).toBe(true);
    expect(useViewStore.getState().activeView).toBe('board');
    expect(screen.getByText('200 %')).toBeTruthy();
  } finally {
    release();
  }
});

test('view_switch_drops_tool_the_view_lacks', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  const initial = snapshot();
  const engine = new FakeEngine(initial);
  const projects: ProjectService = new FakeProjects();
  vi.spyOn(projects, 'open').mockResolvedValue(
    ok({
      projectId: 'test',
      fileId: 'file',
      sessionId: initial.sessionId,
      name: 'Katseplaat',
      path: 'test',
      readOnly: false,
      view: DEFAULT_VIEW_STATE,
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
  const component = { kind: 'component', id: 'cmp_test' };
  const testModule: UiModule = {
    id: 'test-view-tools',
    title: 'Katsevaade',
    tools: [
      {
        id: 'test-tool',
        label: 'Katseriist',
        icon: '',
        group: 'draw',
        create: () => ({
          id: 'test-tool',
          cursor: 'crosshair',
          onPointerDown() {},
          onPointerMove() {},
          onPointerUp() {},
        }),
      },
    ],
    schematicLayers: [
      {
        id: 'test-symbol',
        z: 1,
        render: () => null,
        hits: () => [{ ...component, shape: { type: 'point', at: { x: 50, y: 60 }, r: 3 } }],
      },
    ],
  };
  const { container, unmount } = render(
    <EngineProvider engine={engine} projects={projects}>
      <Workbench host={host} uiModules={() => [testModule]} />
    </EngineProvider>,
  );
  try {
    await act(async () => host.onOpenPath.mock.lastCall![0]('test'));
    const session = useSessionStore.getState;
    act(() => session().setToolId('test-tool'));
    expect(useViewStore.getState().activeView).toBe('board');
    expect(container.querySelector('svg[tabindex]')!.parentElement!.style.cursor).toBe('crosshair');

    expect(pressTab(document.body, { ctrlKey: true })).toBe(true);
    expect(useViewStore.getState().activeView).toBe('schematic');
    expect(session().toolId).toBe('select');
    const svg = container.querySelector('svg[tabindex]')!;
    const scene = svg.querySelector('[data-scene]')!;
    Object.defineProperty(scene, 'getScreenCTM', {
      value: () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }),
    });
    Object.defineProperties(svg, {
      setPointerCapture: { value() {} },
      hasPointerCapture: { value: () => false },
    });
    const click = { button: 0, pointerId: 1, clientX: 50, clientY: 60 };
    fireEvent.pointerDown(svg, click);
    fireEvent.pointerUp(svg, click);
    expect(session().selection.items).toEqual([component]);

    expect(pressTab(document.body, { ctrlKey: true })).toBe(true);
    expect(useViewStore.getState().activeView).toBe('board');
    expect(session().toolId).toBe('select');
  } finally {
    unmount();
    useSessionStore.getState().reset('');
    vi.unstubAllGlobals();
  }
});
