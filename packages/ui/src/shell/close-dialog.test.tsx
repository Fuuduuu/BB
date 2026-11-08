// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CloseDialog } from './CloseDialog';
import { et } from './i18n/et';

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
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});
test('failed close offers retry, rescue and explicit destructive close with its consequence', () => {
  const actions = {
    onRetrySave: vi.fn(),
    onSaveElsewhere: vi.fn(),
    onDiscard: vi.fn(),
    onCancel: vi.fn(),
  };
  render(<CloseDialog open reason="read_only" {...actions} />);
  expect(
    screen.getByRole('dialog', { name: et.save.closeTitle(et.reason.read_only) }),
  ).toBeTruthy();
  const discard = screen.getByRole('button', { name: et.save.discard });
  expect(document.getElementById(discard.getAttribute('aria-describedby')!)?.textContent).toBe(
    et.save.discardHint,
  );
  fireEvent.click(screen.getByRole('button', { name: et.common.retry }));
  fireEvent.click(screen.getByRole('button', { name: et.common.saveElsewhere }));
  fireEvent.click(discard);
  expect(actions.onRetrySave).toHaveBeenCalledOnce();
  expect(actions.onSaveElsewhere).toHaveBeenCalledOnce();
  expect(actions.onDiscard).toHaveBeenCalledOnce();
  expect(actions.onCancel).not.toHaveBeenCalled();
});
test('Escape cancels the close request without discarding changes; busy actions are disabled', () => {
  const actions = {
    onRetrySave: vi.fn(),
    onSaveElsewhere: vi.fn(),
    onDiscard: vi.fn(),
    onCancel: vi.fn(),
  };
  const { rerender } = render(<CloseDialog open reason="disk_full" {...actions} />);
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(actions.onCancel).toHaveBeenCalledOnce();
  actions.onCancel.mockClear();
  rerender(<CloseDialog open reason="disk_full" busy {...actions} />);
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(actions.onCancel).not.toHaveBeenCalled();
  for (const name of [et.common.retry, et.common.saveElsewhere, et.save.discard]) {
    const button = screen.getByRole('button', { name }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
  }
  expect(actions.onDiscard).not.toHaveBeenCalled();
  expect(actions.onRetrySave).not.toHaveBeenCalled();
  expect(actions.onSaveElsewhere).not.toHaveBeenCalled();
});
