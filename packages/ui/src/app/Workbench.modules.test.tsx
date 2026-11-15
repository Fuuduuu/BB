// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import type { AppHost } from '@pcbk/contracts';
import { assertModulePairs, UI_ONLY_MODULES } from '../../../features/composition';
import { FakeEngine, FakeProjects, snapshot } from '../../../client/src/__tests__/fakes';
import { Workbench } from './Workbench';
import { UiRegistry, type UiModule } from '../shell/UiRegistry';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('module_pairs_mismatch_fails_before_workbench', () => {
  const projects = new FakeProjects();
  const opening = vi.spyOn(projects, 'open');
  const creating = vi.spyOn(projects, 'create');
  const host = {
    kind: 'web',
    recents: vi.fn(async () => []),
    removeRecent: async () => {},
    onCloseRequested: () => () => {},
    onOpenPath: vi.fn(() => () => {}),
    closeNow() {},
    reload() {},
    saveDiagnostics: async () => {},
  } satisfies AppHost;
  const validateModules = (modules: readonly UiModule[]) =>
    assertModulePairs(
      ['components'],
      modules.map(({ id }) => id),
      UI_ONLY_MODULES,
    );
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const preventExpectedError = (event: ErrorEvent) => event.preventDefault();
  window.addEventListener('error', preventExpectedError);
  try {
    expect(() =>
      render(
        <EngineProvider engine={new FakeEngine(snapshot())} projects={projects}>
          <Workbench
            host={host}
            uiModules={() => [{ id: 'components-typo', title: 'Components' }]}
            {...{ validateModules }}
          />
        </EngineProvider>,
      ),
    ).toThrow(/Missing engine module.*components-typo/);
    expect(opening).not.toHaveBeenCalled();
    expect(creating).not.toHaveBeenCalled();
    expect(host.recents).not.toHaveBeenCalled();
    expect(host.onOpenPath).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener('error', preventExpectedError);
  }
});

test('product pair validation runs before registering shell home feedback', () => {
  const register = vi.spyOn(UiRegistry.prototype, 'register');
  const validateModules = vi.fn((modules: readonly UiModule[]) => {
    expect(register).not.toHaveBeenCalled();
    assertModulePairs(
      ['components'],
      modules.map(({ id }) => id),
      UI_ONLY_MODULES,
    );
  });
  const host: AppHost = {
    kind: 'web',
    recents: async () => [],
    removeRecent: async () => {},
    onCloseRequested: () => () => {},
    onOpenPath: () => () => {},
    closeNow() {},
    reload() {},
    saveDiagnostics: async () => {},
  };
  render(
    <EngineProvider engine={new FakeEngine(snapshot())} projects={new FakeProjects()}>
      <Workbench
        host={host}
        uiModules={() => ['components', 'guide', 'export'].map((id) => ({ id, title: id }))}
        validateModules={validateModules}
      />
    </EngineProvider>,
  );
  expect(validateModules).toHaveBeenCalledOnce();
  expect(register.mock.calls.map(([module]) => module.id)).toEqual([
    'components',
    'guide',
    'export',
    'home-feedback',
  ]);
});
