export interface HistoryActions {
  undo(): void;
  redo(): void;
}

function isEditing(event: KeyboardEvent): boolean {
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
    if (event.defaultPrevented || event.isComposing || event.altKey || isEditing(event)) return;
    if (!event.ctrlKey && !event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === 'z') {
      event.preventDefault();
      if (event.shiftKey) actions.redo();
      else actions.undo();
    } else if (key === 'y' && !event.shiftKey) {
      event.preventDefault();
      actions.redo();
    }
  };
  target.addEventListener('keydown', listener);
  return () => target.removeEventListener('keydown', listener);
}
