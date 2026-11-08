// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { bindHistoryKeys } from './keymap';

const undo = vi.fn();
const redo = vi.fn();
let unbind: () => void;

beforeEach(() => {
  undo.mockClear();
  redo.mockClear();
  unbind = bindHistoryKeys(window, { undo, redo });
});
afterEach(() => {
  unbind();
  document.body.replaceChildren();
});

function press(target: EventTarget, key: string, extra: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
    ...extra,
  });
  target.dispatchEvent(event);
  return event;
}

test('Ctrl+Z undoes and both redo bindings redo, then cleanup removes the listener', () => {
  expect(press(window, 'z').defaultPrevented).toBe(true);
  press(window, 'y');
  press(window, 'Z', { shiftKey: true });
  expect(undo).toHaveBeenCalledTimes(1);
  expect(redo).toHaveBeenCalledTimes(2);
  unbind();
  press(window, 'z');
  expect(undo).toHaveBeenCalledTimes(1);
});

test.each(['input', 'textarea', 'select'])(
  'Ctrl+Z inside %s keeps the native editing behavior',
  (tag) => {
    const field = document.createElement(tag);
    document.body.append(field);
    expect(press(field, 'z').defaultPrevented).toBe(false);
    press(field, 'y');
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
  },
);

test('contenteditable descendants keep native undo, including plaintext-only editors', () => {
  document.body.innerHTML =
    '<div contenteditable="true"><span id="rich">text</span></div><div contenteditable="plaintext-only"><span id="plain">text</span></div>';
  for (const id of ['rich', 'plain']) {
    const child = document.getElementById(id)!;
    expect(press(child, 'z').defaultPrevented).toBe(false);
  }
  expect(undo).not.toHaveBeenCalled();
});

test('composition, consumed shortcuts, Alt combinations and ordinary typing are ignored', () => {
  press(window, 'z', { isComposing: true });
  press(window, 'z', { altKey: true });
  press(window, 'z', { ctrlKey: false });
  const consumed = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true });
  consumed.preventDefault();
  window.dispatchEvent(consumed);
  expect(undo).not.toHaveBeenCalled();
  expect(redo).not.toHaveBeenCalled();
});

test('an explicitly noneditable island keeps document shortcuts, and Meta works on macOS', () => {
  document.body.innerHTML =
    '<div contenteditable="true"><div contenteditable="false"><button>Action</button></div></div>';
  press(document.querySelector('button')!, 'z', { ctrlKey: false, metaKey: true });
  expect(undo).toHaveBeenCalledTimes(1);
});
test('an open modal never sends history shortcuts to the document behind it', () => {
  document.body.innerHTML = '<dialog open><button>Proovi uuesti</button></dialog>';
  const button = document.querySelector('button')!;
  press(button, 'z');
  press(button, 'y');
  expect(undo).not.toHaveBeenCalled();
  expect(redo).not.toHaveBeenCalled();
});
