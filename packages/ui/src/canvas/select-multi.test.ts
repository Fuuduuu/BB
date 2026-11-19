// @vitest-environment jsdom
import type { Snapshot } from '@pcbk/contracts';
import { expect, test, vi } from 'vitest';
import { newBoardDoc } from '../../../domain/src/doc';
import type { Preview, Selection } from '../shell/session-store';
import type { HitItem } from './hit-index';
import { createSelectToolSpec } from './SelectTool';
import type { CanvasPointer, ToolApi } from './tools';

test('shift_click_toggles_component_and_pin', () => {
  const otherPin = { kind: 'pin', id: '1', componentId: 'cmp_other' };
  const component = { kind: 'component', id: 'cmp_selected' } as const;
  const pin = { ...otherPin, componentId: component.id };
  const commit = vi.fn();
  const shape = { type: 'point', at: { x: 0, y: 0 }, r: 1 } as const;
  const body: HitItem = { ...component, shape };
  const pad: HitItem = { ...pin, shape, moves: component };
  const label: HitItem = { ...body, target: component, drag: { owner: 'label', commit } };
  let selection: Selection = { items: [otherPin] };
  let preview: Preview | null = null;
  const execute = vi.fn<ToolApi['execute']>(() => ({ ok: true, value: { rev: 1 } }));
  const snapshot: Snapshot = {
    sessionId: 'board',
    rev: 0,
    doc: newBoardDoc('Plaat'),
    derived: { unplacedBoard: [], unplacedSchematic: [], pinReadings: {} },
    history: { canUndo: false, canRedo: false },
  };
  const api: ToolApi = {
    execute,
    select: (next) => (selection = next),
    setPreview: (next) => (preview = next),
    hitIndex: { query: () => undefined },
    snapshot: () => snapshot,
    sceneTransform: () => 'none',
  };
  const tool = createSelectToolSpec(
    () => selection,
    (_snapshot, items) =>
      items.some(({ kind, id }) => kind === component.kind && id === component.id)
        ? [component]
        : [],
  ).create();
  const pointer = (hit?: HitItem): CanvasPointer => ({
    screen: { x: 100, y: 100 },
    world: { x: 20, y: 30 },
    shift: true,
    alt: false,
    ctrl: false,
    hit,
  });
  const click = (hit?: HitItem) => {
    const point = pointer(hit);
    tool.onPointerDown(point, api);
    tool.onPointerUp(point, api);
  };

  const down = pointer(body);
  tool.onPointerDown(down, api);
  expect(selection.items).toEqual([otherPin]);
  expect(preview).toBeNull();
  tool.onPointerUp(down, api);
  expect(selection.items).toEqual([otherPin, component]);
  click(pad);
  expect(selection.items).toEqual([otherPin, component, pin]);
  click(body);
  expect(selection.items).toEqual([otherPin, pin]);
  click();
  expect(selection.items).toEqual([otherPin, pin]);

  const end = { ...pointer(), screen: { x: 112, y: 120 }, world: { x: 14, y: 37 } };
  for (const hit of [body, label]) {
    tool.onPointerDown(pointer(hit), api);
    expect(selection.items).toEqual([otherPin, pin]);
    expect(preview).toBeNull();
    tool.onPointerMove(end, api);
    expect(preview).toEqual({
      owner: 'select.frame',
      data: { min: { x: 14, y: 30 }, max: { x: 20, y: 37 } },
    });
    tool.onPointerUp(end, api);
    expect(preview).toBeNull();
  }
  expect(selection.items).toEqual([otherPin, pin]);
  expect(execute).not.toHaveBeenCalled();
  expect(commit).not.toHaveBeenCalled();
});
