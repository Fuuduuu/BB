// @vitest-environment jsdom
import { EngineProvider } from '@pcbk/client';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { FakeEngine, FakeProjects, snapshot } from '../../../client/src/__tests__/fakes';
import { useCursorStore } from '../canvas/cursor-store';
import { bindPanelKeys } from './keymap';
import { ViewControls } from './ViewControls';
import { useViewStore } from './view-store';

afterEach(() => {
  cleanup();
  useViewStore.getState().reset();
  useCursorStore.setState({ world: null });
});

function pressTab(target: EventTarget, modifiers: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event.defaultPrevented;
}

test('view_switch_key_and_controls_follow_active_view', () => {
  const initial = snapshot();
  const engine = new FakeEngine({
    ...initial,
    doc: { ...initial.doc, scale: { ...initial.doc.scale, pxPerMm: 10 } },
  });
  useViewStore.setState({
    activeView: 'board',
    boardView: { zoom: 2, pan: { x: 0, y: 0 } },
    schematicView: { zoom: 3.7795, pan: { x: 0, y: 0 } },
  });
  useCursorStore.setState({ world: { x: 25.4, y: 12.7 } });
  render(
    <EngineProvider engine={engine} projects={new FakeProjects()}>
      <ViewControls />
      <input aria-label="Tekstiväli" />
      <dialog open>
        <button type="button">Dialoogi toiming</button>
      </dialog>
    </EngineProvider>,
  );

  const release = bindPanelKeys(window, { navigator: vi.fn(), context: vi.fn() });
  try {
    expect(screen.getByText('200 %')).toBeTruthy();
    expect(pressTab(document.body)).toBe(false);

    const input = screen.getByRole('textbox', { name: 'Tekstiväli' });
    input.focus();
    expect(pressTab(input, { ctrlKey: true })).toBe(false);

    const dialogButton = screen.getByRole('button', { name: 'Dialoogi toiming' });
    dialogButton.focus();
    expect(pressTab(dialogButton, { ctrlKey: true })).toBe(false);
    expect(useViewStore.getState().activeView).toBe('board');
    dialogButton.blur();
    screen.getByRole('dialog').removeAttribute('open');

    expect(pressTab(document.body, { ctrlKey: true })).toBe(true);
    expect(useViewStore.getState().activeView).toBe('schematic');
    expect(screen.getByText('100 %')).toBeTruthy();
    expect(screen.getByText('X 25,4 mm · Y 12,7 mm')).toBeTruthy();

    expect(pressTab(document.body, { ctrlKey: true, shiftKey: true })).toBe(true);
    expect(useViewStore.getState().activeView).toBe('board');
    expect(screen.getByText('200 %')).toBeTruthy();
  } finally {
    release();
  }
});
