// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import { DEFAULT_VIEW_STATE, ok } from '@pcbk/contracts';
import type { AppHost, ProjectService } from '@pcbk/contracts';
import { FakeEngine, FakeProjects, snapshot } from '../../../client/src/__tests__/fakes';
import { Workbench } from './Workbench';
import { useViewStore } from '../shell/view-store';
import { useSessionStore } from '../shell/session-store';

afterEach(() => {
  cleanup();
  useViewStore.getState().reset();
  vi.unstubAllGlobals();
});

test('workbench_fit_tracks_overlay_open_closed_wide_and_resized_panel', async () => {
  let wide = false;
  const listeners = new Set<() => void>();
  const media = {
    get matches() {
      return wide;
    },
    addEventListener: (_: string, notify: () => void) => listeners.add(notify),
    removeEventListener: (_: string, notify: () => void) => listeners.delete(notify),
  };
  vi.stubGlobal('matchMedia', (query: string) =>
    query === '(min-width: 1280px)'
      ? media
      : {
          matches: false,
          addEventListener() {},
          removeEventListener() {},
        },
  );
  const engine = new FakeEngine(snapshot());
  const projects: ProjectService = new FakeProjects();
  vi.spyOn(projects, 'open').mockResolvedValue(
    ok({
      projectId: 'test',
      fileId: 'file',
      sessionId: 'session-a',
      name: 'Board',
      path: 'test',
      readOnly: false,
      view: { ...DEFAULT_VIEW_STATE, contextWidth: 340, contextOpen: true },
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
  const app = render(
    <EngineProvider engine={engine} projects={projects}>
      <Workbench host={host} uiModules={() => []} />
    </EngineProvider>,
  );
  await act(async () => host.onOpenPath.mock.lastCall![0]('test'));
  const svg = app.container.querySelector('svg[tabindex]')!;
  Object.defineProperties(svg, {
    getBoundingClientRect: {
      value: () => ({ left: 304, top: 60, right: 1100, bottom: 660, width: 796, height: 600 }),
    },
    getScreenCTM: {
      value: () => ({ inverse: () => ({ a: 0.5, b: 0, c: 0, d: 0.5, e: -152, f: -30 }) }),
    },
  });
  function expectFit(right: number) {
    fireEvent.click(screen.getByRole('button', { name: 'Sobita' }));
    const zoom = Math.min(((796 - right) * 0.9) / 4000, (600 * 0.9) / 2800);
    expect(useViewStore.getState().boardView.zoom).toBeCloseTo(zoom, 8);
    expect(useViewStore.getState().boardView.pan.x).toBeCloseTo((796 - right) / 4 - 1000 * zoom, 8);
  }
  expectFit(0);
  act(() => useSessionStore.getState().setSelection({ items: [{ kind: 'net', id: 'net_fit' }] }));
  expectFit(340);
  fireEvent.keyDown(screen.getByRole('separator', { name: 'Omaduste paneeli laius' }), {
    key: 'ArrowLeft',
  });
  expect(useViewStore.getState().contextWidth).toBe(350);
  expectFit(350);
  fireEvent.click(screen.getByRole('button', { name: 'Peida omadused' }));
  expectFit(0);
  fireEvent.click(screen.getByRole('button', { name: 'Näita omadusi' }));
  expectFit(350);
  act(() => {
    wide = true;
    for (const notify of listeners) notify();
  });
  expectFit(350);
  act(() => {
    wide = false;
    for (const notify of listeners) notify();
  });
  expectFit(350);
  act(() => useSessionStore.getState().setSelection({ items: [] }));
  expectFit(0);
  expect(engine.snapshot().rev).toBe(0);
});
