// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { boardSurface } from '@pcbk/domain/geometry';
import { et, useSessionStore, useViewStore } from '@pcbk/ui';
import { createRuntime } from './runtime';
import { fakeHost, mount, openWorkbenchProject, seedProject } from './test-support/workbench';

test('navigator_open_survives_reopen_without_rev', async () => {
  let runtime = createRuntime();
  const project = await seedProject(runtime, 'Peidetud navigaator');
  let { host } = fakeHost();
  let app = mount(runtime, host);
  try {
    await openWorkbenchProject(runtime, host, project.path);
    const before = runtime.engine.snapshot();
    const saveView = vi.spyOn(runtime.projects, 'saveView');
    fireEvent.click(screen.getByRole('button', { name: 'Peida navigaator' }));
    expect(saveView).toHaveBeenCalled();
    await act(async () => expect((await runtime.projects.flush()).ok).toBe(true));
    expect(runtime.engine.snapshot()).toMatchObject({ rev: before.rev, history: before.history });
    expect(runtime.engine.snapshot().doc).toEqual(before.doc);
    app.unmount();
    expect((await runtime.projects.close()).ok).toBe(true);

    runtime = createRuntime();
    ({ host } = fakeHost());
    app = mount(runtime, host);
    await openWorkbenchProject(runtime, host, project.path);
    expect(useViewStore.getState().navigatorOpen).toBe(false);
    expect(useViewStore.getState().navigatorWidth).toBe(300);
    expect(screen.queryByRole('complementary', { name: et.shell.navigator })).toBeNull();
    expect(screen.getByRole('button', { name: 'Näita navigaatorit' })).toBeTruthy();
    expect(runtime.engine.snapshot().rev).toBe(before.rev);
    expect(runtime.engine.snapshot().doc).toEqual(before.doc);
  } finally {
    app.unmount();
    await runtime.projects.discard();
  }
});

test('fit_insets_follow_context_shown', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  const runtime = createRuntime();
  const project = await seedProject(runtime, 'Ujuva paneeli sobitus');
  const { host } = fakeHost();
  const app = mount(runtime, host);
  try {
    await openWorkbenchProject(runtime, host, project.path);
    const svg = screen.getByRole('main', { name: et.shell.canvas }).querySelector('svg')!;
    Object.defineProperties(svg, {
      getBoundingClientRect: {
        value: () => ({ left: 0, top: 0, right: 1000, bottom: 2000, width: 1000, height: 2000 }),
      },
      getScreenCTM: {
        value: () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }),
      },
    });
    const { width } = boardSurface(runtime.engine.snapshot().doc);
    const fittedCenter = () => {
      act(() => useViewStore.getState().requestFit());
      const { zoom, pan } = useViewStore.getState().boardView;
      return (width / 2) * zoom + pan.x;
    };
    expect(useViewStore.getState().contextOpen).toBe(true);
    expect(useViewStore.getState().contextShown).toBe(false);
    expect(fittedCenter()).toBeCloseTo(500);

    const saveView = vi.spyOn(runtime.projects, 'saveView');
    act(() => useSessionStore.getState().setSelection({ items: [{ kind: 'net', id: 'net_fit' }] }));
    expect(useViewStore.getState().contextShown).toBe(true);
    // Computed visibility alone is transient and must not schedule view persistence.
    expect(saveView).not.toHaveBeenCalled();
    expect(fittedCenter()).toBeCloseTo(330);
    act(() => useViewStore.getState().setContextWidth(400));
    expect(fittedCenter()).toBeCloseTo(300);

    act(() => useViewStore.getState().setContextOpen(false));
    expect(useViewStore.getState().contextShown).toBe(false);
    expect(fittedCenter()).toBeCloseTo(500);
    act(() => useViewStore.getState().setContextOpen(true));
    expect(fittedCenter()).toBeCloseTo(300);
    act(() => useSessionStore.getState().setSelection({ items: [] }));
    expect(useViewStore.getState().contextOpen).toBe(true);
    expect(useViewStore.getState().contextShown).toBe(false);
    expect(fittedCenter()).toBeCloseTo(500);
  } finally {
    app.unmount();
    await runtime.projects.discard();
    vi.unstubAllGlobals();
  }
});
