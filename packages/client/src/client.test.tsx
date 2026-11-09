// @vitest-environment jsdom
import { StrictMode } from 'react';
import type { PropsWithChildren } from 'react';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as api from './index';
import { FakeEngine, FakeProjects, saved, snapshot } from './__tests__/fakes';

beforeEach(() => {
  expect(api.EngineProvider).toBeTypeOf('function');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function fixture(engine = new FakeEngine(), projects = new FakeProjects(), strict = false) {
  function wrapper({ children }: PropsWithChildren) {
    const provider = (
      <api.EngineProvider engine={engine} projects={projects}>
        {children}
      </api.EngineProvider>
    );
    return strict ? <StrictMode>{provider}</StrictMode> : provider;
  }
  return { engine, projects, wrapper };
}
test('provider exposes the injected engine and project service through their public contracts', () => {
  const { engine, projects, wrapper } = fixture();
  const { result } = renderHook(() => ({ engine: api.useEngine(), projects: api.useProjects() }), {
    wrapper,
  });
  expect(result.current.engine).toBe(engine);
  expect(result.current.projects).toBe(projects);
});
test('same snapshot reference does not rerender; a new revision reaches the consumer', () => {
  const { engine, wrapper } = fixture();
  let renders = 0;
  const { result } = renderHook(
    () => {
      renders++;
      return api.useSnapshot((s) => s.doc.name);
    },
    { wrapper },
  );
  const before = renders;
  act(() => {
    engine.ping();
    engine.ping();
  });
  expect(renders).toBe(before);
  act(() => {
    engine.replace(snapshot('session-a', 1, 'Changed'));
  });
  expect(result.current).toBe('Changed');
  expect(renders).toBeGreaterThan(before);
});
test('object selectors are stable for the same source snapshot', () => {
  const { engine, wrapper } = fixture();
  const { result } = renderHook(() => api.useSnapshot((s) => ({ title: s.doc.name })), { wrapper });
  const before = result.current;
  act(() => {
    engine.ping();
  });
  expect(result.current).toBe(before);
  act(() => {
    engine.replace(snapshot('session-a', 1, 'Changed'));
  });
  expect(result.current).toEqual({ title: 'Changed' });
});
test('changing the selector recomputes the result without a document change', () => {
  const { wrapper } = fixture();
  const { result, rerender } = renderHook(
    ({ session }) => api.useSnapshot((s) => (session ? s.sessionId : s.doc.name)),
    { wrapper, initialProps: { session: false } },
  );
  expect(result.current).toBe('Board');
  rerender({ session: true });
  expect(result.current).toBe('session-a');
});
test.each([3, 2])(
  'a same-session snapshot with rev %i cannot replace the accepted rev 3',
  (rev) => {
    const { engine, wrapper } = fixture(new FakeEngine(snapshot('session-a', 3, 'Newest')));
    const { result } = renderHook(() => api.useSnapshot((s) => s.doc.name), { wrapper });
    act(() => {
      engine.replace(snapshot('session-a', rev, 'Stale'));
    });
    expect(result.current).toBe('Newest');
  },
);
test('new session accepts a lower revision and unloading clears the old document', () => {
  const { engine, wrapper } = fixture(new FakeEngine(snapshot('session-a', 9, 'Old')));
  const { result } = renderHook(() => api.useSnapshot((s) => s.doc.name), { wrapper });
  act(() => {
    engine.replace(snapshot('session-b', 0, 'New'));
  });
  expect(result.current).toBe('New');
  act(() => {
    engine.replace(snapshot('', 0, ''));
  });
  expect(result.current).toBe('');
});
test('a stale subscription payload does not replace the current getter snapshot', () => {
  const { engine, wrapper } = fixture();
  const { result } = renderHook(() => api.useSnapshot((s) => s.doc.name), { wrapper });
  act(() => {
    engine.ping(snapshot('old-session', 99, 'Stale'));
  });
  expect(result.current).toBe('Board');
});
test('an old-session error cannot overwrite the active saved status', () => {
  const { projects, wrapper } = fixture();
  projects.emit(saved());
  const { result } = renderHook(() => api.useSaveStatus(), { wrapper });
  expect(result.current).toEqual({ state: 'saved', rev: 0, at: '2026-11-08T10:00:00.000Z' });
  act(() => {
    projects.emit({ sessionId: 'old', state: 'error', reason: 'disk_full' });
  });
  expect(result.current.state).toBe('saved');
  act(() => {
    projects.emit({ sessionId: 'session-a', state: 'error', reason: 'read_only' });
  });
  expect(result.current).toEqual({ state: 'error', reason: 'read_only' });
});
test('no status notice means pending, without an invented saved time', () => {
  const { wrapper } = fixture();
  const { result } = renderHook(() => api.useSaveStatus(), { wrapper });
  expect(result.current).toEqual({ state: 'pending' });
});
test('the current error is replayed when a consumer mounts after project opening', () => {
  const { projects, wrapper } = fixture();
  projects.emit({ sessionId: 'session-a', state: 'error', reason: 'disk_full' });
  const { result } = renderHook(() => api.useSaveStatus(), { wrapper });
  expect(result.current).toEqual({ state: 'error', reason: 'disk_full' });
});
test('session change resets status immediately and delayed old notices remain ignored', () => {
  const { engine, projects, wrapper } = fixture();
  projects.emit(saved());
  const { result } = renderHook(() => api.useSaveStatus(), { wrapper });
  act(() => {
    engine.replace(snapshot('session-b', 0, 'New'));
  });
  expect(result.current).toEqual({ state: 'pending' });
  act(() => {
    projects.emit({ sessionId: 'session-a', state: 'error', reason: 'disk_full' });
  });
  expect(result.current).toEqual({ state: 'pending' });
  act(() => {
    projects.emit(saved('session-b'));
  });
  expect(result.current.state).toBe('saved');
  act(() => {
    engine.replace(snapshot('', 0, ''));
  });
  expect(result.current).toEqual({ state: 'pending' });
  act(() => {
    projects.emit(saved('', 0));
  });
  expect(result.current).toEqual({ state: 'pending' });
});
test('a saved notice for an older document revision cannot claim the newest document is saved', () => {
  const { engine, projects, wrapper } = fixture();
  projects.emit(saved());
  const { result } = renderHook(() => api.useSaveStatus(), { wrapper });
  act(() => {
    engine.replace(snapshot('session-a', 1, 'Unsaved'));
  });
  expect(result.current).toEqual({ state: 'pending' });
  act(() => {
    projects.emit(saved('session-a', 0));
  });
  expect(result.current).toEqual({ state: 'pending' });
  act(() => {
    projects.emit(saved('session-a', 1));
  });
  expect(result.current).toMatchObject({ state: 'saved', rev: 1 });
});
test('unmount and StrictMode release engine and status subscriptions', () => {
  const { engine, projects, wrapper } = fixture(undefined, undefined, true);
  const { unmount } = renderHook(() => api.useSaveStatus(), { wrapper });
  expect(engine.listeners.size).toBeGreaterThan(0);
  expect(projects.listeners.size).toBeGreaterThan(0);
  unmount();
  expect(engine.listeners.size).toBe(0);
  expect(projects.listeners.size).toBe(0);
});
test('provider source replacement releases old subscriptions even when session ids match', () => {
  const a = fixture();
  const b = fixture(new FakeEngine(snapshot('session-a', 0, 'Other')));
  a.projects.emit({ sessionId: 'session-a', state: 'error', reason: 'disk_full' });
  b.projects.emit(saved());
  function Probe() {
    return (
      <span data-testid="value">
        {api.useSnapshot((s) => s.doc.name)}:{api.useSaveStatus().state}
      </span>
    );
  }
  const { rerender, unmount } = render(
    <api.EngineProvider engine={a.engine} projects={a.projects}>
      <Probe />
    </api.EngineProvider>,
  );
  expect(screen.getByTestId('value').textContent).toBe('Board:error');
  rerender(
    <api.EngineProvider engine={b.engine} projects={b.projects}>
      <Probe />
    </api.EngineProvider>,
  );
  expect(screen.getByTestId('value').textContent).toBe('Other:saved');
  expect(a.engine.listeners.size).toBe(0);
  expect(a.projects.listeners.size).toBe(0);
  act(() => {
    a.projects.emit({ sessionId: 'session-a', state: 'error', reason: 'read_only' });
  });
  expect(screen.getByTestId('value').textContent).toBe('Other:saved');
  unmount();
  expect(b.engine.listeners.size).toBe(0);
  expect(b.projects.listeners.size).toBe(0);
});
test.each(['useEngine', 'useProjects'] as const)(
  '%s fails clearly outside EngineProvider',
  (hook) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const expectedError = (event: ErrorEvent) => {
      if (event.error instanceof Error && event.error.message === 'missing_engine_provider')
        event.preventDefault();
    };
    window.addEventListener('error', expectedError);
    try {
      expect(() => renderHook(() => api[hook]())).toThrow('missing_engine_provider');
    } finally {
      window.removeEventListener('error', expectedError);
    }
  },
);
