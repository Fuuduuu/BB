import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import type { Snapshot } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import { et } from '../shell/i18n/et';
import type { Selection } from '../shell/session-store';
import type { ContextMenuItemSpec } from '../shell/UiRegistry';
import { visibleCanvasBounds, type CanvasInsets } from './use-canvas-context-menu';
import './context-menu.css';

interface ContextMenuProps {
  menuRef: RefObject<HTMLDivElement>;
  viewport: RefObject<HTMLDivElement>;
  fitInsets?: CanvasInsets;
  screen: Vec2;
  items: ContextMenuItemSpec[];
  selection: Selection;
  snapshot: Snapshot;
  close(): void;
  activate(item: ContextMenuItemSpec): void;
}

export function ContextMenu({
  menuRef,
  viewport,
  fitInsets,
  screen,
  items,
  selection,
  snapshot,
  close,
  activate,
}: ContextMenuProps) {
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const parent = viewport.current;
    if (!menu || !parent) return;
    const position = () => {
      const bounds = parent.getBoundingClientRect();
      const visible = visibleCanvasBounds(bounds, fitInsets);
      menu.style.setProperty('--menu-available-width', `${visible.width}px`);
      menu.style.setProperty('--menu-available-height', `${visible.height}px`);
      const x = Math.max(0, Math.min(screen.x - visible.left, visible.width - menu.offsetWidth));
      const y = Math.max(0, Math.min(screen.y - visible.top, visible.height - menu.offsetHeight));
      menu.style.left = `${visible.left - bounds.left + x}px`;
      menu.style.top = `${visible.top - bounds.top + y}px`;
    };
    position();
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position);
    resize?.observe(parent);
    resize?.observe(menu);
    return () => resize?.disconnect();
  }, [fitInsets, menuRef, screen, viewport]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    function onKeyDown(event: KeyboardEvent) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const index = buttons.findIndex((button) => button === document.activeElement);
      switch (event.key) {
        case 'Escape':
        case 'Tab':
          close();
          break;
        case 'ArrowDown':
          buttons[(index + 1) % buttons.length]?.focus();
          break;
        case 'ArrowUp':
          buttons[(Math.max(index, 0) + buttons.length - 1) % buttons.length]?.focus();
          break;
        case 'Home':
          buttons[0]?.focus();
          break;
        case 'End':
          buttons.at(-1)?.focus();
          break;
        case 'Enter':
        case ' ':
          buttons[Math.max(index, 0)]?.click();
          break;
      }
    }
    buttons[0]?.focus({ preventScroll: true });
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('wheel', close, { capture: true, passive: true });
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('wheel', close, true);
      window.removeEventListener('blur', close);
    };
  }, [close, items, menuRef, screen]);

  return (
    <div
      ref={menuRef}
      className="bb-canvas-menu"
      role="menu"
      aria-label={et.shell.contextMenu}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      {items.map((item) => {
        const shortcut = item.shortcut;
        const key = shortcut && `${shortcut.shift ? 'Shift+' : ''}${shortcut.key}`;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-keyshortcuts={shortcut ? `${shortcut.primary ? 'Control+' : ''}${key}` : undefined}
            onClick={() => activate(item)}
          >
            <span>{item.label(snapshot, selection)}</span>
            {shortcut && (
              <kbd aria-hidden="true">
                {shortcut.primary ? 'Ctrl+' : ''}
                {key}
              </kbd>
            )}
          </button>
        );
      })}
    </div>
  );
}
