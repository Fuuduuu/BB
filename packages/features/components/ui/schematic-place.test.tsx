// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import { DEFAULT_VIEW_STATE, ok } from '@pcbk/contracts';
import type { AppHost, ProjectService } from '@pcbk/contracts';
import { newBoardDoc } from '@pcbk/domain';
import { useSessionStore, useViewStore, Workbench } from '@pcbk/ui';
import { FakeProjects } from '../../../client/src/__tests__/fakes';
import { idGenerator, setupWithAllFeatures } from '../../__tests__/helpers';
import { createComponentsUi } from './index';
import { usePlaceStore } from './place-store';

afterEach(() => {
  cleanup();
  usePlaceStore.getState().reset();
  useSessionStore.getState().reset('');
  useViewStore.getState().reset();
  vi.unstubAllGlobals();
});

function clickCanvas(container: HTMLElement, x: number, y: number) {
  const svg = container.querySelector('svg[tabindex]')!;
  Object.defineProperties(svg, {
    setPointerCapture: { configurable: true, value: () => {} },
    hasPointerCapture: { configurable: true, value: () => true },
    releasePointerCapture: { configurable: true, value: () => {} },
  });
  Object.defineProperty(svg.querySelector('[data-scene]'), 'getScreenCTM', {
    configurable: true,
    value: () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }),
  });
  for (const type of ['pointerdown', 'pointerup']) {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    fireEvent(svg, event);
  }
  return svg;
}

test('schematic_place_from_library_and_unplaced_list', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  const doc = newBoardDoc('Skeemipaigutuse proov');
  for (const [kind, ref] of [
    ['via', 'V1'],
    ['hole', 'H1'],
  ] as const) {
    doc.components.push({
      id: 'cmp_' + kind,
      kind,
      ref,
      marking: '',
      value: '',
      identified: false,
      dnp: false,
      note: '',
      pins: [],
      schematic: { symbol: 'box', at: { x: 0, y: 0 }, rot: 0, mirror: false },
    });
  }
  const { engine } = setupWithAllFeatures(doc);
  const existing = 'cmp_existing';
  expect(
    engine.execute('components.add', {
      id: existing,
      kind: 'resistor',
      ref: 'R2',
      pins: [
        { id: '1', uid: 'pin_existing_1' },
        { id: '2', uid: 'pin_existing_2' },
      ],
    }).ok,
  ).toBe(true);
  const projects: ProjectService = new FakeProjects();
  vi.spyOn(projects, 'open').mockResolvedValue(
    ok({
      projectId: 'test',
      fileId: 'file',
      sessionId: engine.snapshot().sessionId,
      name: 'Skeemipaigutuse proov',
      path: 'test',
      readOnly: false,
      view: { ...DEFAULT_VIEW_STATE, schematicView: { zoom: 1, pan: { x: 0, y: 0 } } },
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
  const ui = createComponentsUi(idGenerator());
  const { container } = render(
    <EngineProvider engine={engine} projects={projects}>
      <Workbench host={host} uiModules={() => [ui]} />
    </EngineProvider>,
  );
  await act(async () => host.onOpenPath.mock.lastCall![0]('test'));

  fireEvent.click(screen.getByRole('button', { name: /^Skeem$/ }));
  fireEvent.click(screen.getByRole('tab', { name: 'Teek' }));
  fireEvent.click(screen.getByRole('button', { name: 'Takisti SMD' }));
  fireEvent.click(screen.getByRole('button', { name: /^Paiguta$/ }));
  expect(useSessionStore.getState().toolId).toBe('components.placeSchematic');

  const svg = clickCanvas(container, 13, 8);
  const added = engine
    .snapshot()
    .doc.components.find(
      ({ id }) => id !== existing && id.startsWith('cmp_') && !['cmp_via', 'cmp_hole'].includes(id),
    )!;
  expect(added).toMatchObject({
    kind: 'resistor',
    pins: [{ id: '1' }, { id: '2' }],
    schematic: { at: { x: 12.7, y: 7.62 }, rot: 0, mirror: false },
  });
  expect(added.board).toBeUndefined();
  expect(useSessionStore.getState().toolId).toBe('components.placeSchematic');
  fireEvent.keyDown(svg, { key: 'Escape' });
  expect(useSessionStore.getState().toolId).toBe('select');

  fireEvent.click(screen.getByRole('button', { name: /^Plaat$/ }));
  fireEvent.click(screen.getByRole('tab', { name: 'Komponendid' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Paigutamata (4)' }));
  const addedRow = screen.getByRole('button', { name: 'Vali ' + added.ref }).closest('li')!;
  fireEvent.click(within(addedRow).getByRole('button', { name: 'Paiguta plaadile' }));
  fireEvent.click(within(addedRow).getByRole('button', { name: 'Takisti SMD' }));
  clickCanvas(container, 100, 80);
  const paired = engine.snapshot().doc.components.find(({ id }) => id === added.id);
  expect(paired?.board?.center).toEqual({ x: 100, y: 80 });
  expect(paired?.schematic).toEqual(added.schematic);

  fireEvent.click(screen.getByRole('button', { name: /^Skeem$/ }));
  fireEvent.click(screen.getByRole('radio', { name: 'Skeemil (1)' }));
  expect(screen.queryByRole('button', { name: 'Vali V1' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Vali H1' })).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: 'Paigutamata (1)' }));
  expect(screen.queryByRole('button', { name: 'Vali V1' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Vali H1' })).toBeNull();
  const existingRow = screen.getByRole('button', { name: 'Vali R2' }).closest('li')!;
  fireEvent.click(within(existingRow).getByRole('button', { name: 'Paiguta skeemile' }));
  clickCanvas(container, 24, 13);
  expect(useSessionStore.getState().toolId).toBe('select');
  expect(
    engine.snapshot().doc.components.find(({ id }) => id === existing)?.schematic,
  ).toMatchObject({ at: { x: 22.86, y: 12.7 }, rot: 0, mirror: false });
  expect(screen.getByRole('radio', { name: 'Skeemil (2)' })).toBeTruthy();
});
