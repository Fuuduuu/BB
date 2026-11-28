/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EngineProvider } from '@pcbk/client';
import { DEFAULT_VIEW_STATE, ok } from '@pcbk/contracts';
import type { AppHost, BoardView, ProjectService } from '@pcbk/contracts';
import type { Component, Vec2 } from '@pcbk/domain';
import { afterEach, expect, test, vi } from 'vitest';
import { useSessionStore, useViewStore } from '@pcbk/ui';
import { FakeEngine, FakeProjects, snapshot } from '../../../client/src/__tests__/fakes';
import { Workbench } from '../../../ui/src/app/Workbench';
import { idGenerator } from '../../__tests__/helpers';
import { uiFeatures } from '../../ui';

const boardView = { zoom: 1.75, pan: { x: 37, y: -23 } };
const schematicView = { zoom: 2.85, pan: { x: 17, y: -3 } };
const contextWidth = 320;
const visibleCenter = { x: (1000 - contextWidth) / 2, y: 600 / 2 };
const boardAt = { x: 45, y: 30 };
const schematicAt = { x: 50.8, y: 76.2 };
const boardOnlyAt = { x: 175, y: 90 };
const schematicOnlyAt = { x: 101.6, y: 114.3 };
const otherBoardAt = { x: 85, y: 140 };
const otherSchematicAt = { x: 172.72, y: 81.28 };

function component(ref: string, board: Vec2 | null, schematic: Vec2 | null): Component {
  const id = `cmp_${ref.toLowerCase()}`;
  return {
    id,
    ref,
    kind: 'resistor',
    marking: '',
    value: '',
    identified: true,
    dnp: false,
    note: '',
    pins: ['1', '2'].map((idOfPin) => ({
      id: idOfPin,
      uid: `pin_${id}_${idOfPin}`,
      nc: false,
    })),
    ...(board && {
      board: {
        footprint: 'chip',
        params: { size: '0805' },
        center: board,
        side: 'top',
        rotationDeg: 0,
        scaleX: 1,
        scaleY: 1,
        customPads: {},
      },
    }),
    ...(schematic && {
      schematic: { symbol: 'resistor', at: schematic, rot: 0, mirror: false },
    }),
  };
}

function measure(svg: SVGSVGElement) {
  Object.defineProperties(svg.parentElement!, {
    getBoundingClientRect: {
      value: () => ({ left: 10, top: 15, right: 1010, bottom: 615, width: 1000, height: 600 }),
    },
    clientWidth: { value: 1000 },
    clientHeight: { value: 600 },
  });
  fireEvent(window, new Event('resize'));
}

function openMenu(svg: SVGSVGElement, { x, y }: Vec2) {
  Object.defineProperty(svg.querySelector('[data-scene]')!, 'getScreenCTM', {
    configurable: true,
    value: () => ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }),
  });
  fireEvent.contextMenu(svg, { button: 2, clientX: x, clientY: y });
  return within(screen.getByRole('menu', { name: 'Toimingud' }));
}

async function expectCentered(view: 'boardView' | 'schematicView', point: Vec2, old: BoardView) {
  await waitFor(() => {
    const { zoom, pan } = useViewStore.getState()[view]!;
    expect(zoom).toBe(old.zoom);
    expect(Math.abs(point.x * zoom + pan.x - visibleCenter.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(point.y * zoom + pan.y - visibleCenter.y)).toBeLessThanOrEqual(1);
    expect(useViewStore.getState().revealRequest).toBeNull();
  });
}

afterEach(() => {
  cleanup();
  useViewStore.getState().reset();
  useSessionStore.getState().reset('');
  vi.unstubAllGlobals();
});

test('show_in_other_view_keeps_zoom_and_selection', async () => {
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
      activePhotoId: 'pho_test',
      photos: [
        {
          id: 'pho_test',
          side: 'top',
          name: 'Sünteetiline foto',
          widthPx: 400,
          heightPx: 300,
          transform: 'rot90',
        },
      ],
      components: [
        component('R1', boardAt, schematicAt),
        component('R2', boardOnlyAt, null),
        component('R3', null, schematicOnlyAt),
        component('R4', otherBoardAt, otherSchematicAt),
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
      view: { ...DEFAULT_VIEW_STATE, contextWidth, boardView, schematicView },
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
      <Workbench host={host} uiModules={(onHome) => uiFeatures(idGenerator(), onHome)} />
    </EngineProvider>,
  );
  await act(async () => host.onOpenPath.mock.lastCall![0]('test'));
  const canvas = () => container.querySelector<SVGSVGElement>('svg[tabindex]')!;
  const selectedR1 = () =>
    expect(useSessionStore.getState().selection.items).toEqual([
      { kind: 'component', id: 'cmp_r1' },
    ]);

  const board = canvas();
  measure(board);
  expect(
    openMenu(board, boardOnlyAt).queryByRole('menuitem', { name: 'Näita skeemil' }),
  ).toBeNull();
  expect(useViewStore.getState().boardView).toEqual(boardView);
  fireEvent.click(openMenu(board, boardAt).getByRole('menuitem', { name: 'Näita skeemil' }));
  expect(useViewStore.getState().activeView).toBe('schematic');
  selectedR1();
  expect(useViewStore.getState().schematicView).toEqual(schematicView);

  const schematic = canvas();
  expect(schematic).not.toBe(board);
  measure(schematic);
  await expectCentered('schematicView', schematicAt, schematicView);
  const displayedSchematic = useViewStore.getState().schematicView;
  expect(
    openMenu(schematic, schematicOnlyAt).queryByRole('menuitem', { name: 'Näita plaadil' }),
  ).toBeNull();
  expect(useViewStore.getState().schematicView).toEqual(displayedSchematic);
  fireEvent.click(
    openMenu(schematic, schematicAt).getByRole('menuitem', { name: 'Näita plaadil' }),
  );
  expect(useViewStore.getState().activeView).toBe('board');
  selectedR1();
  expect(useViewStore.getState().boardView).toEqual(boardView);

  const returnedBoard = canvas();
  expect(returnedBoard).not.toBe(schematic);
  measure(returnedBoard);
  await expectCentered('boardView', { x: 300 - boardAt.y, y: boardAt.x }, boardView);
  expect(useViewStore.getState().schematicView).toEqual(displayedSchematic);

  const boardSelection = {
    items: ['cmp_r1', 'cmp_r4', 'cmp_r2'].map((id) => ({ kind: 'component' as const, id })),
  };
  act(() => useSessionStore.getState().setSelection(boardSelection));
  fireEvent.click(
    openMenu(returnedBoard, otherBoardAt).getByRole('menuitem', { name: 'Näita skeemil' }),
  );
  expect(useSessionStore.getState().selection).toEqual(boardSelection);
  const returnedSchematic = canvas();
  measure(returnedSchematic);
  await expectCentered('schematicView', otherSchematicAt, schematicView);

  const schematicSelection = {
    items: ['cmp_r3', 'cmp_r1', 'cmp_r4'].map((id) => ({ kind: 'component' as const, id })),
  };
  act(() => useSessionStore.getState().setSelection(schematicSelection));
  fireEvent.click(
    openMenu(returnedSchematic, schematicOnlyAt).getByRole('menuitem', { name: 'Näita plaadil' }),
  );
  expect(useSessionStore.getState().selection).toEqual(schematicSelection);
  measure(canvas());
  await expectCentered('boardView', { x: 300 - boardAt.y, y: boardAt.x }, boardView);
});
