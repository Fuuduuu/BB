// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { snapshot } from '../../../client/src/__tests__/fakes';
import { useSessionStore } from '../shell/session-store';
import { Canvas, type CanvasProps } from './Canvas';

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
