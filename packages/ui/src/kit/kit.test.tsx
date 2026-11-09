// @vitest-environment jsdom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Button, Dialog, Field, Panel, Toast } from './index';

const dialogMethods = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
};

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const name of ['showModal', 'close'] as const) {
    const original = dialogMethods[name];
    if (original) Object.defineProperty(HTMLDialogElement.prototype, name, original);
    else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>)[name];
  }
});

test('buttons avoid accidental form submission and preserve native disabled behavior', () => {
  const submit = vi.fn((event: Event) => event.preventDefault());
  const click = vi.fn();
  const { container } = render(
    <form>
      <Button onClick={click}>Lisa</Button>
      <Button disabled>Keelatud</Button>
    </form>,
  );
  container.querySelector('form')?.addEventListener('submit', submit);
  fireEvent.click(screen.getByRole('button', { name: 'Lisa' }));
  expect(click).toHaveBeenCalledOnce();
  expect(submit).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: 'Keelatud' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
});

test('field connects its label, hint and validation message to the input', () => {
  render(
    <Field
      label="Tähis"
      hint="Korpuse juures"
      error="Tähis on juba olemas"
      aria-describedby="extra"
    />,
  );
  const input = screen.getByRole('textbox', { name: 'Tähis' });
  expect(input.getAttribute('aria-invalid')).toBe('true');
  const described = input.getAttribute('aria-describedby')?.split(' ') ?? [];
  expect(described).toContain('extra');
  expect(
    described
      .filter((id) => document.getElementById(id))
      .map((id) => document.getElementById(id)?.textContent),
  ).toEqual(['Korpuse juures', 'Tähis on juba olemas']);
});

test('panel is a named region and exposes its actions', () => {
  render(
    <Panel title="Omadused" actions={<Button>Muuda</Button>}>
      <p>R1</p>
    </Panel>,
  );
  expect(screen.getByRole('region', { name: 'Omadused' }).textContent).toContain('R1');
  expect(screen.getByRole('button', { name: 'Muuda' })).toBeTruthy();
});

test('dialog is controlled, labelled and requests close on Escape without losing parent state', () => {
  const close = vi.fn();
  const { rerender } = render(
    <Dialog open title="Sulgemine" onClose={close}>
      <p>Sisu</p>
    </Dialog>,
  );
  const dialog = screen.getByRole('dialog', { name: 'Sulgemine' });
  const cancel = new Event('cancel', { bubbles: false, cancelable: true });
  fireEvent(dialog, cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(close).toHaveBeenCalledOnce();
  expect(dialog.hasAttribute('open')).toBe(true);
  rerender(
    <Dialog open={false} title="Sulgemine" onClose={close}>
      Sisu
    </Dialog>,
  );
  expect(dialog.hasAttribute('open')).toBe(false);
});

test('dialog close button is named in Estonian', () => {
  const close = vi.fn();
  render(
    <Dialog open title="Sulgemine" onClose={close}>
      Sisu
    </Dialog>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Sulge' }));
  expect(close).toHaveBeenCalledOnce();
});

test('toast viewport displays at most three newest messages and dismisses after 2.5 seconds', () => {
  vi.useFakeTimers();
  const dismiss = vi.fn();
  render(
    <Toast
      items={[1, 2, 3, 4].map((n) => ({ id: String(n), message: `Teade ${n}` }))}
      onDismiss={dismiss}
    />,
  );
  expect(screen.queryByText('Teade 1')).toBeNull();
  expect(screen.getAllByRole('status')).toHaveLength(3);
  act(() => {
    vi.advanceTimersByTime(2499);
  });
  expect(dismiss.mock.calls.map(([id]) => id)).toEqual(['1']);
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(dismiss.mock.calls.map(([id]) => id)).toEqual(['1', '2', '3', '4']);
});

test('overflow messages are removed instead of reappearing when another toast is dismissed', () => {
  function Notifications() {
    const [items, setItems] = useState(
      [1, 2, 3, 4].map((n) => ({ id: String(n), message: `Teade ${n}` })),
    );
    return (
      <Toast
        items={items}
        onDismiss={(id) => setItems((current) => current.filter((item) => item.id !== id))}
      />
    );
  }
  render(<Notifications />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Peida teade' })[0]!);
  expect(screen.queryByText('Teade 1')).toBeNull();
  expect(screen.queryByText('Teade 2')).toBeNull();
  expect(screen.getAllByRole('status')).toHaveLength(2);
});

test('toast timeout survives parent rerenders and timers are cancelled on unmount', () => {
  vi.useFakeTimers();
  const first = vi.fn();
  const latest = vi.fn();
  const items = [{ id: 'one', message: 'Lisatud' }];
  const { rerender, unmount } = render(<Toast items={items} onDismiss={first} />);
  act(() => {
    vi.advanceTimersByTime(2000);
  });
  rerender(<Toast items={items} onDismiss={latest} />);
  act(() => {
    vi.advanceTimersByTime(500);
  });
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledWith('one');
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
