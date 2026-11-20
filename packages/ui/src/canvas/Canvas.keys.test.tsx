// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { snapshot } from '../../../client/src/__tests__/fakes';
import { useSessionStore } from '../shell/session-store';
import { Canvas, type CanvasProps } from './Canvas';
import { UiRegistry } from '../shell/UiRegistry';

const getSession = useSessionStore.getState;
const component = { kind: 'component', id: 'cmp_selected' };

afterEach(() => {
  cleanup();
  getSession().reset('');
});

function setup(props: Partial<CanvasProps> = {}) {
  const current = snapshot();
  getSession().reset(current.sessionId);
  getSession().setSelection({ items: [component] });
  return render(
    <>
      <Canvas
        layers={[]}
        tools={[]}
        sceneTransform="none"
        view={{ zoom: 1, pan: { x: 0, y: 0 } }}
        onViewChange={() => {}}
        snapshot={current}
        execute={() => ({ ok: true, value: { rev: 1 } })}
        {...props}
      />
      <input aria-label="Input" />
      <textarea aria-label="Textarea" />
      <select aria-label="Select" />
      <div contentEditable suppressContentEditableWarning>
        <span data-testid="editor-child" />
      </div>
      <dialog open>
        <button type="button">Dialog button</button>
      </dialog>
    </>,
  ).container.querySelector('svg')!;
}

test('shell_keys_are_rejected_for_modules_and_free_key_runs', () => {
  const registry = new UiRegistry();
  for (const key of [
    'Escape',
    'N',
    'O',
    'V',
    'H',
    ' ',
    'Ctrl+Z',
    'Ctrl+Y',
    'Ctrl+Shift+Z',
    'Meta+Z',
    'Meta+Y',
    'Meta+Shift+Z',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
  ]) {
    expect(
      () =>
        registry.register({
          id: `conflict-${key}`,
          title: 'Conflict',
          keys: [{ id: 'conflict', key, run: () => true }],
        }),
      key,
    ).toThrow(/keyboard shortcut/);
    expect(registry.modules()).toEqual([]);
    expect(
      () =>
        registry.register({
          id: `tool-conflict-${key}`,
          title: 'Conflict',
          tools: [
            {
              id: 'custom',
              label: 'Custom',
              icon: '',
              group: 'draw',
              key,
              create: () => {
                throw new Error('Conflicting tool must never be created');
              },
            },
          ],
        }),
      key,
    ).toThrow(/keyboard shortcut/);
    expect(registry.modules()).toEqual([]);
  }
  for (const key of ['Escape', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    expect(
      () =>
        registry.register({
          id: `shift-conflict-${key}`,
          title: 'Conflict',
          keys: [{ id: 'conflict', key, shift: true, run: () => true }],
        }),
      `Shift+${key}`,
    ).toThrow(/keyboard shortcut/);
  }
  let calls = 0;
  registry.register({
    id: 'free',
    title: 'Free',
    keys: [
      {
        id: 'free-key',
        key: 'K',
        run: () => {
          calls++;
          return true;
        },
      },
    ],
  });
  const svg = setup({ keys: registry.keys() });
  expect(fireEvent.keyDown(svg, { key: 'k' })).toBe(false);
  expect(calls).toBe(1);
});

test('canvas_keys_do_not_fire_inside_input', () => {
  const svg = setup({
    keys: [
      {
        id: 'clear',
        key: 'R',
        run(api, selection) {
          if (!selection.items.length) return false;
          api.select({ items: [] });
          return true;
        },
      },
    ],
  });
  const targets = [
    screen.getByLabelText('Input'),
    screen.getByLabelText('Textarea'),
    screen.getByLabelText('Select'),
    screen.getByTestId('editor-child'),
    screen.getByRole('button', { name: 'Dialog button' }),
  ];
  for (const target of targets) {
    expect(fireEvent.keyDown(target, { key: 'r' })).toBe(true);
    expect(getSession().selection.items).toEqual([component]);
  }
  expect(fireEvent.keyDown(svg, { key: 'r', ctrlKey: true })).toBe(true);
  expect(fireEvent.keyDown(svg, { key: 'r', metaKey: true })).toBe(true);
  expect(fireEvent.keyDown(svg, { key: 'r', altKey: true })).toBe(true);
  expect(fireEvent.keyDown(svg, { key: 'r', isComposing: true })).toBe(true);
  expect(getSession().selection.items).toEqual([component]);

  expect(fireEvent.keyDown(svg, { key: 'r' })).toBe(false);
  expect(getSession().selection.items).toEqual([]);
  expect(fireEvent.keyDown(svg, { key: 'r' })).toBe(true);
});

test('canvas module keys match Shift and yield to the active tool', () => {
  const pickedByTool = { kind: 'component', id: 'cmp_tool' };
  const svg = setup({
    keys: [
      {
        id: 'clear',
        key: 'R',
        shift: true,
        run(api) {
          api.select({ items: [] });
          return true;
        },
      },
    ],
    tools: [
      {
        id: 'custom',
        key: 'T',
        label: 'Custom',
        icon: '',
        group: 'draw',
        create: () => ({
          id: 'custom',
          cursor: 'crosshair',
          onPointerDown() {},
          onPointerMove() {},
          onPointerUp() {},
          onKey(event, api) {
            if (event.key !== 'R') return false;
            api.select({ items: [pickedByTool] });
            return true;
          },
        }),
      },
    ],
  });
  expect(fireEvent.keyDown(svg, { key: 'r' })).toBe(true);
  expect(getSession().selection.items).toEqual([component]);
  expect(fireEvent.keyDown(svg, { key: 'R', shiftKey: true })).toBe(false);
  expect(getSession().selection.items).toEqual([]);
  fireEvent.keyDown(svg, { key: 't' });
  expect(fireEvent.keyDown(svg, { key: 'R', shiftKey: true })).toBe(false);
  expect(getSession().selection.items).toEqual([pickedByTool]);
});

test('a matching module key consumes repeats even when the action would decline', () => {
  const svg = setup({ keys: [{ id: 'decline', key: 'R', run: () => false }] });
  expect(fireEvent.keyDown(svg, { key: 'r' })).toBe(true);
  expect(fireEvent.keyDown(svg, { key: 'r', repeat: true })).toBe(false);
  expect(fireEvent.keyDown(svg, { key: 'x', repeat: true })).toBe(true);
});

test('a module key with repeat enabled handles repeated keydowns', () => {
  const svg = setup({
    keys: [
      {
        id: 'clear',
        key: 'R',
        repeat: true,
        run(api) {
          api.select({ items: [] });
          return true;
        },
      },
    ],
  });
  expect(fireEvent.keyDown(svg, { key: 'r', repeat: true })).toBe(false);
  expect(getSession().selection.items).toEqual([]);
});

test('escape cancels the outgoing tool once', () => {
  let cancellations = 0;
  const svg = setup({
    tools: [
      {
        id: 'custom',
        key: 'T',
        label: 'Custom',
        icon: '',
        group: 'draw',
        create: () => ({
          id: 'custom',
          cursor: 'crosshair',
          onPointerDown() {},
          onPointerMove() {},
          onPointerUp() {},
          onCancel() {
            cancellations++;
          },
        }),
      },
    ],
  });
  fireEvent.keyDown(svg, { key: 't' });
  fireEvent.keyDown(svg, { key: 'Escape' });
  expect(getSession()).toMatchObject({ toolId: 'select', selection: { items: [] } });
  expect(cancellations).toBe(1);
});

test('context_menu_uses_the_board_area_visible_beside_overlay_panels', () => {
  const run = vi.fn(() => true);
  const svg = setup({
    fitInsets: { left: 20, right: 240, top: 10, bottom: 30 },
    contextMenu: () => [
      { id: 'test', appliesTo: ['component', 'empty'], order: 10, label: () => 'Toiming', run },
    ],
  });
  const viewport = svg.parentElement!;
  viewport.getBoundingClientRect = () => new DOMRect(10, 20, 600, 400);
  const scene = svg.querySelector<SVGGElement>('[data-scene]')!;
  scene.getScreenCTM = () =>
    ({ inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) }) as DOMMatrix;

  const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(180);
  const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(80);
  try {
    fireEvent.keyDown(svg, { key: 'F10', shiftKey: true });
    fireEvent.click(screen.getByRole('menuitem'));
    expect(run).toHaveBeenCalledWith(
      expect.anything(),
      { items: [component] },
      { x: 200, y: 210 },
      component,
    );

    fireEvent.pointerDown(svg, { button: 2 });
    fireEvent.contextMenu(svg, { button: 2, clientX: 360, clientY: 380 });
    const menu = screen.getByRole('menu');
    expect(menu.style.left).toBe('180px');
    expect(menu.style.top).toBe('290px');
  } finally {
    width.mockRestore();
    height.mockRestore();
  }
});
