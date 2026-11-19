import { useLayoutEffect } from 'react';
import type { MutableRefObject } from 'react';
import { isEditing, matchesShellKey, SHELL_KEYS } from '../shell/keymap';
import { useSessionStore } from '../shell/session-store';
import type { KeySpec } from '../shell/UiRegistry';
import type { CanvasTool, ToolApi, ToolSpec } from './tools';

interface CanvasKeys {
  active: CanvasTool;
  api: ToolApi;
  cancel(tool: CanvasTool): void;
  cancelGesture(): void;
  keys?: readonly KeySpec[];
  openContextMenu(): void;
  space: MutableRefObject<boolean>;
  specs: readonly ToolSpec[];
}

const getSession = useSessionStore.getState;

export function useCanvasKeys({
  active,
  api,
  cancel,
  cancelGesture,
  keys,
  openContextMenu,
  space,
  specs,
}: CanvasKeys) {
  useLayoutEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        isEditing(event)
      )
        return;
      if (
        matchesShellKey(event, SHELL_KEYS.contextMenu) ||
        matchesShellKey(event, SHELL_KEYS.contextMenuKey)
      ) {
        if (!event.repeat) openContextMenu();
        event.preventDefault();
        return;
      }
      if (matchesShellKey(event, SHELL_KEYS.cancel)) {
        space.current = false;
        // Switching tools cancels the outgoing tool in the layout cleanup.
        if (getSession().toolId === 'select') cancel(active);
        else getSession().setToolId('select');
        api.select({ items: [] });
        event.preventDefault();
        return;
      }
      if (matchesShellKey(event, SHELL_KEYS.temporaryPan)) {
        if (event.target instanceof Element && event.target.closest('button, a[href]')) return;
        space.current = true;
        event.preventDefault();
        return;
      }
      if (active.onKey?.(event, api)) {
        event.preventDefault();
        return;
      }
      if (event.altKey) return;
      const key = event.key.toLowerCase();
      const binding = keys?.find(
        (spec) => spec.key.toLowerCase() === key && (spec.shift ?? false) === event.shiftKey,
      );
      if (binding && event.repeat && binding.repeat !== true) {
        event.preventDefault();
        return;
      }
      if (binding?.run(api, getSession().selection)) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey) return;
      const tool = specs.find((spec) => spec.key?.toLowerCase() === key);
      if (tool) {
        getSession().setToolId(tool.id);
        event.preventDefault();
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key === SHELL_KEYS.temporaryPan.key) space.current = false;
    }
    function onBlur() {
      space.current = false;
      cancelGesture();
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [active, api, cancel, cancelGesture, keys, openContextMenu, space, specs]);
}
