import { useViewStore } from './view-store';

export interface HistoryActions {
  undo(): void;
  redo(): void;
}

interface ShellKey {
  key: string;
  primary?: boolean;
  shift?: boolean | 'any';
  alt?: boolean | 'any';
}

export const SHELL_KEYS = {
  cancel: { key: 'Escape', shift: 'any', alt: 'any' },
  navigator: { key: 'N' },
  context: { key: 'O' },
  view: { key: 'Tab', primary: true, shift: 'any' },
  undo: { key: 'Z', primary: true },
  redo: { key: 'Y', primary: true },
  redoShift: { key: 'Z', primary: true, shift: true },
  select: { key: 'V' },
  pan: { key: 'H' },
  temporaryPan: { key: ' ', shift: 'any' },
  contextMenu: { key: 'F10', shift: true },
  contextMenuKey: { key: 'ContextMenu' },
  nudgeLeft: { key: 'ArrowLeft', shift: 'any' },
  nudgeRight: { key: 'ArrowRight', shift: 'any' },
  delete: { key: 'Delete' },
  nudgeUp: { key: 'ArrowUp', shift: 'any' },
  nudgeDown: { key: 'ArrowDown', shift: 'any' },
} as const satisfies Record<string, ShellKey>;

type KeyEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>;

export function matchesShellKey(event: KeyEvent, binding: ShellKey): boolean {
  return (
    event.key.toLowerCase() === binding.key.toLowerCase() &&
    Boolean(event.ctrlKey || event.metaKey) === (binding.primary ?? false) &&
    (binding.shift === 'any' || event.shiftKey === (binding.shift ?? false)) &&
    (binding.alt === 'any' || event.altKey === (binding.alt ?? false))
  );
}

export function isShellShortcut(key: string, shift = false): boolean {
  const parts = key.split('+');
  const modifiers = parts.slice(0, -1).map((part) => part.toLowerCase());
  const event = {
    key: parts[parts.length - 1]!,
    ctrlKey: modifiers.includes('ctrl'),
    metaKey: modifiers.includes('meta'),
    altKey: modifiers.includes('alt'),
    shiftKey: shift || modifiers.includes('shift'),
  };
  return Object.values(SHELL_KEYS).some((binding) => matchesShellKey(event, binding));
}

export function isEditing(event: KeyboardEvent): boolean {
  for (const node of event.composedPath()) {
    if (!(node instanceof Element)) continue;
    if (node.matches('dialog[open], [role="dialog"][aria-modal="true"]')) return true;
    if (node.matches('input, textarea, select')) return true;
    const editor = node.closest('[contenteditable]');
    if (editor !== null) return editor.getAttribute('contenteditable')?.toLowerCase() !== 'false';
  }
  return false;
}

export function bindHistoryKeys(target: Window, actions: HistoryActions): () => void {
  const listener = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || isEditing(event)) return;
    if (matchesShellKey(event, SHELL_KEYS.undo)) {
      event.preventDefault();
      actions.undo();
    } else if (
      matchesShellKey(event, SHELL_KEYS.redo) ||
      matchesShellKey(event, SHELL_KEYS.redoShift)
    ) {
      event.preventDefault();
      actions.redo();
    }
  };
  target.addEventListener('keydown', listener);
  return () => target.removeEventListener('keydown', listener);
}

export function bindPanelKeys(
  target: Window,
  actions: { navigator(): void; context(): void },
): () => void {
  const listener = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || event.repeat || isEditing(event)) return;
    if (matchesShellKey(event, SHELL_KEYS.view)) {
      event.preventDefault();
      useViewStore.getState().toggleView();
      return;
    }
    const navigator = matchesShellKey(event, SHELL_KEYS.navigator);
    if (!navigator && !matchesShellKey(event, SHELL_KEYS.context)) return;
    event.preventDefault();
    if (navigator) actions.navigator();
    else actions.context();
  };
  target.addEventListener('keydown', listener);
  return () => target.removeEventListener('keydown', listener);
}
