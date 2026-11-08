// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { NewBoardDialog } from './NewBoardDialog';
import { StartScreen } from './StartScreen';
import type { RecentProjectCard } from './StartScreen';
import { et } from './i18n/et';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 8, 0, 30));
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
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

test('creation cannot be canceled after a non-abortable write starts', () => {
  const onClose = vi.fn();
  render(<NewBoardDialog open busy onCreate={vi.fn()} onClose={onClose} />);
  const cancel = screen.getByRole('button', { name: et.common.cancel }) as HTMLButtonElement;
  expect(cancel.disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: et.common.close }));
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(onClose).not.toHaveBeenCalled();
});
test('open list can find durable projects outside the bounded recent list', () => {
  const old = {
    path: 'web://old',
    projectId: 'old',
    name: 'Vana plaat',
    updatedAt: '2026-11-01T10:00:00Z',
  };
  const onOpen = vi.fn();
  render(
    <StartScreen
      recent={[]}
      availableProjects={[old]}
      onNew={vi.fn()}
      onOpen={onOpen}
      onRemoveRecent={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: et.project.open }));
  const list = screen.getByRole('dialog', { name: et.project.openTitle });
  fireEvent.click(within(list).getByRole('button', { name: et.project.openNamed(old.name) }));
  expect(onOpen).toHaveBeenCalledExactlyOnceWith(old.path);
});

test('zero-input board creation uses today in local calendar and is immediately available', () => {
  const onCreate = vi.fn();
  render(<NewBoardDialog open onCreate={onCreate} onClose={vi.fn()} />);
  const start = screen.getByRole('button', { name: et.project.start }) as HTMLButtonElement;
  expect(start.disabled).toBe(false);
  expect(document.activeElement).toBe(screen.getByLabelText(et.project.name));
  expect((screen.getByLabelText(et.project.name) as HTMLInputElement).value).toBe(
    'Plaat 2026-11-08',
  );
  fireEvent.click(start);
  expect(onCreate).toHaveBeenCalledExactlyOnceWith({ name: 'Plaat 2026-11-08' });
});

test('blank name falls back to the default instead of blocking creation', () => {
  const onCreate = vi.fn();
  render(<NewBoardDialog open onCreate={onCreate} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(et.project.name), { target: { value: '   ' } });
  fireEvent.click(screen.getByRole('button', { name: et.project.start }));
  expect(onCreate).toHaveBeenCalledExactlyOnceWith({ name: 'Plaat 2026-11-08' });
});

test('form submission includes trimmed optional fields with the board name', () => {
  const onCreate = vi.fn();
  render(<NewBoardDialog open onCreate={onCreate} onClose={vi.fn()} />);
  const name = screen.getByLabelText(et.project.name) as HTMLInputElement;
  expect(name.maxLength).toBe(120);
  fireEvent.change(name, { target: { value: '  Toiteplaat  ' } });
  fireEvent.change(screen.getByLabelText(et.project.device), { target: { value: '  Raadio  ' } });
  fireEvent.change(screen.getByLabelText(et.project.problem), {
    target: { value: '  Ei käivitu  ' },
  });
  expect(name.form).not.toBeNull();
  fireEvent.submit(name.form!);
  expect(onCreate).toHaveBeenCalledExactlyOnceWith({
    name: 'Toiteplaat',
    device: 'Raadio',
    problem: 'Ei käivitu',
  });
  expect(screen.getAllByRole('textbox')).toHaveLength(3);
});

test('cancel and Escape do not create a board', () => {
  const onCreate = vi.fn();
  const onClose = vi.fn();
  render(<NewBoardDialog open onCreate={onCreate} onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: et.common.cancel }));
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(onClose).toHaveBeenCalledTimes(2);
  expect(onCreate).not.toHaveBeenCalled();
});

test('rerender preserves edits while close and reopen resets a new form', () => {
  const actions = { onCreate: vi.fn(), onClose: vi.fn() };
  const { rerender } = render(<NewBoardDialog open {...actions} />);
  fireEvent.change(screen.getByLabelText(et.project.name), { target: { value: 'Minu plaat' } });
  rerender(<NewBoardDialog open error={et.project.createFailed} {...actions} />);
  expect((screen.getByLabelText(et.project.name) as HTMLInputElement).value).toBe('Minu plaat');
  expect(screen.getByRole('alert').textContent).toBe(et.project.createFailed);
  rerender(<NewBoardDialog open={false} {...actions} />);
  vi.setSystemTime(new Date(2026, 10, 9, 0, 30));
  rerender(<NewBoardDialog open {...actions} />);
  expect((screen.getByLabelText(et.project.name) as HTMLInputElement).value).toBe(
    'Plaat 2026-11-09',
  );
});

test('submitted request cannot be duplicated before parent acknowledges busy state', () => {
  const onCreate = vi.fn();
  render(<NewBoardDialog open onCreate={onCreate} onClose={vi.fn()} />);
  const form = (screen.getByLabelText(et.project.name) as HTMLInputElement).form!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(onCreate).toHaveBeenCalledOnce();
});

test('busy request stays visible until writing finishes and an error permits retry', () => {
  const actions = { onCreate: vi.fn(), onClose: vi.fn() };
  const { rerender } = render(<NewBoardDialog open busy {...actions} />);
  const start = screen.getByRole('button', { name: et.project.start }) as HTMLButtonElement;
  expect(start.disabled).toBe(true);
  fireEvent.submit((screen.getByLabelText(et.project.name) as HTMLInputElement).form!);
  expect(actions.onCreate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: et.common.cancel }));
  expect(actions.onClose).not.toHaveBeenCalled();
  rerender(<NewBoardDialog open error={et.project.createFailed} {...actions} />);
  expect(start.disabled).toBe(false);
  fireEvent.click(start);
  expect(actions.onCreate).toHaveBeenCalledOnce();
});

const recent: readonly RecentProjectCard[] = [
  {
    path: 'web://radio',
    projectId: 'radio',
    name: 'Raadio plaat',
    device: 'R-20',
    updatedAt: '2026-11-07T14:30:00.000Z',
  },
  {
    path: 'web://lost',
    projectId: 'lost',
    name: 'Kadunud plaat',
    updatedAt: '2026-11-06T09:00:00.000Z',
    missing: true,
  },
];

test('start screen opens the chosen recent path and disables unavailable projects and restore', () => {
  const actions = { onNew: vi.fn(), onOpen: vi.fn(), onRemoveRecent: vi.fn() };
  render(<StartScreen recent={recent} {...actions} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ava Raadio plaat' }));
  expect(actions.onOpen).toHaveBeenCalledExactlyOnceWith('web://radio');
  expect(screen.getByText('R-20')).toBeTruthy();
  const time = screen.getByText(
    new Date(recent[0]!.updatedAt).toLocaleString('et-EE', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  );
  expect(time.textContent).toMatch(/\d{2}:\d{2}$/);
  expect(time.textContent).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  expect(time.getAttribute('datetime')).toBe(recent[0]!.updatedAt);
  const missing = screen.getByRole('button', { name: 'Ava Kadunud plaat' }) as HTMLButtonElement;
  expect(missing.disabled).toBe(true);
  fireEvent.click(missing);
  expect(actions.onOpen).toHaveBeenCalledTimes(1);
  expect(screen.getByText(et.project.missing)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: et.project.removeRecent }));
  expect(actions.onRemoveRecent).toHaveBeenCalledExactlyOnceWith('web://lost');
  for (const restore of screen.getAllByRole('button', { name: et.project.restore })) {
    expect((restore as HTMLButtonElement).disabled).toBe(true);
    expect(restore.title).toBe(et.project.restoreUnavailable);
  }
});

test('browser open button lists stored projects in a dialog and opens the chosen path', () => {
  const actions = { onNew: vi.fn(), onOpen: vi.fn(), onRemoveRecent: vi.fn() };
  render(<StartScreen recent={recent} {...actions} />);
  fireEvent.click(screen.getByRole('button', { name: et.project.open }));
  const dialog = screen.getByRole('dialog', { name: et.project.openTitle });
  expect(within(dialog).getByText(et.project.browserStorage)).toBeTruthy();
  expect(
    (within(dialog).getByRole('button', { name: 'Ava Kadunud plaat' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Ava Raadio plaat' }));
  expect(actions.onOpen).toHaveBeenCalledExactlyOnceWith('web://radio');
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('first launch explains the empty state and offers immediate creation and browser open list', () => {
  const actions = { onNew: vi.fn(), onOpen: vi.fn(), onRemoveRecent: vi.fn() };
  render(<StartScreen recent={[]} {...actions} />);
  expect(screen.getByRole('heading', { name: et.appName })).toBeTruthy();
  expect(screen.getByText(et.project.noRecent)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: et.project.newBoard }));
  expect(actions.onNew).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: et.project.open }));
  expect(within(screen.getByRole('dialog')).getByText(et.project.emptyOpen)).toBeTruthy();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(actions.onOpen).not.toHaveBeenCalled();
});
