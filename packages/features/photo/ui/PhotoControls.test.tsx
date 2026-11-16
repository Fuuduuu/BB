// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import type { ProjectService } from '@pcbk/contracts';
import type { BoardDoc } from '@pcbk/domain';
import { useSessionStore, useViewStore } from '@pcbk/ui';
import { photoUiFixture } from '../__tests__/ui-fixture';
import { createPhotoUi } from './index';

const open: ProjectService[] = [];
afterEach(async () => {
  cleanup();
  useViewStore.getState().reset();
  useSessionStore.getState().setToolId('select');
  for (const projects of open.splice(0)) await projects.discard();
});

async function fixture(withPhoto = true) {
  const { engine, host, projects } = photoUiFixture();
  open.push(projects);
  expect((await projects.create({ name: 'Foto' })).ok).toBe(true);
  if (withPhoto) {
    expect(
      engine.execute('photo.add', {
        photo: {
          id: 'pho_1',
          side: 'top',
          name: 'Plaat',
          widthPx: 300,
          heightPx: 200,
          transform: 'mirror',
        },
      }).ok,
    ).toBe(true);
  }
  render(
    <EngineProvider engine={engine} projects={projects}>
      {createPhotoUi().bottomBar?.[0]?.render()}
    </EngineProvider>,
  );
  return { engine, host };
}

function openSettings() {
  const trigger = screen.getByRole('button', { name: 'Foto sätted' });
  fireEvent.click(trigger);
  return { trigger, menu: screen.getByRole('dialog', { name: 'Foto sätted' }) };
}

test('photo_controls_change_view_without_document_revision', async () => {
  const { engine } = await fixture();
  const before = engine.snapshot();
  openSettings();
  fireEvent.change(screen.getByRole('slider', { name: /Läbipaistvus/ }), {
    target: { value: '35' },
  });
  fireEvent.change(screen.getByRole('slider', { name: /Kontrast/ }), { target: { value: '140' } });
  fireEvent.click(screen.getByRole('button', { name: 'Hall' }));
  fireEvent.click(screen.getByRole('button', { name: 'Peida foto' }));
  expect(useViewStore.getState().modules.photo).toEqual({
    visible: false,
    opacity: 0.35,
    contrast: 1.4,
    gray: true,
  });
  expect(screen.getByRole('button', { name: 'Näita fotot' }).getAttribute('aria-pressed')).toBe(
    'true',
  );
  expect(screen.getByRole('button', { name: 'Hall' }).getAttribute('aria-pressed')).toBe('true');
  expect(engine.snapshot()).toBe(before);
});

test('rotate_and_mirror_are_single_undoable_steps', async () => {
  const { engine } = await fixture();
  const before = engine.snapshot();
  openSettings();
  fireEvent.click(screen.getByRole('button', { name: 'Pööra 90°' }));
  expect(engine.snapshot().rev).toBe(before.rev + 1);
  expect(engine.snapshot().doc).toEqual({
    ...before.doc,
    rev: before.rev + 1,
    photos: [{ ...before.doc.photos[0], transform: 'mirror_rot90' }],
  });
  fireEvent.click(screen.getByRole('button', { name: 'Peegelda' }));
  expect(engine.snapshot().rev).toBe(before.rev + 2);
  expect(engine.snapshot().doc.photos[0]?.transform).toBe('rot270');
  act(() => {
    expect(engine.undo().ok).toBe(true);
  });
  expect(engine.snapshot().doc.photos[0]?.transform).toBe('mirror_rot90');
  act(() => {
    expect(engine.undo().ok).toBe(true);
  });
  expect(engine.snapshot().doc).toEqual({ ...before.doc, rev: before.rev + 4 });
  act(() => {
    expect(engine.redo().ok).toBe(true);
  });
  expect(engine.snapshot().doc.photos[0]?.transform).toBe('mirror_rot90');
});

test('scale_chip_shows_uncalibrated_or_px_per_mm', async () => {
  const { engine } = await fixture(false);
  const chip = screen.getByText('Kalibreerimata');
  expect(chip.closest('button')?.getAttribute('aria-label')).toBe('Kalibreeri mõõtkava (K)');
  expect(screen.queryByRole('button', { name: 'Pööra 90°' })).toBeNull();
  expect(screen.queryByRole('slider')).toBeNull();
  act(() => {
    expect(
      engine.execute('photo.setScale', {
        a: { x: 0, y: 0 },
        b: { x: 281, y: 0 },
        mm: 20,
      }).ok,
    ).toBe(true);
  });
  expect(screen.getByRole('button', { name: 'Kalibreeri mõõtkava (K)' }).textContent).toBe(
    '14,05 px/mm',
  );
});

test('uncalibrated_shortcut_starts_calibration', async () => {
  const { engine } = await fixture();
  const before = engine.snapshot();
  fireEvent.click(screen.getByRole('button', { name: 'Kalibreeri mõõtkava (K)' }));
  expect(useSessionStore.getState().toolId).toBe('photo.calibrate');
  expect(engine.snapshot()).toBe(before);
});

test('read_only_photo_blocks_transform_but_allows_view_controls', async () => {
  const { engine, host } = await fixture();
  const before = engine.snapshot();
  act(() => host.load(before.sessionId, structuredClone(before.doc) as BoardDoc, true));
  const readOnly = engine.snapshot();
  openSettings();
  fireEvent.click(screen.getByRole('button', { name: 'Pööra 90°' }));
  expect(engine.snapshot()).toBe(readOnly);
  expect(screen.getByRole('alert').textContent).toBe('Projekt on kirjutuskaitstud.');
  fireEvent.click(screen.getByRole('button', { name: 'Peegelda' }));
  expect(engine.snapshot()).toBe(readOnly);
  fireEvent.click(screen.getByRole('button', { name: 'Hall' }));
  expect(useViewStore.getState().modules.photo).toMatchObject({ gray: true });
  expect(engine.snapshot()).toBe(readOnly);
});

test('photo_settings_menu_opens_with_focus_on_first_slider', async () => {
  await fixture();
  expect(screen.queryByRole('dialog', { name: 'Foto sätted' })).toBeNull();
  expect(screen.queryByRole('slider')).toBeNull();
  const { trigger, menu } = openSettings();
  expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(trigger.getAttribute('aria-controls')).toBe(menu.id);
  expect(menu.getAttribute('aria-modal')).not.toBe('true');
  const controls = [...within(menu).getAllByRole('slider'), ...within(menu).getAllByRole('button')];
  expect(
    controls.map((control) => control.getAttribute('aria-label') ?? control.textContent),
  ).toEqual(['Läbipaistvus', 'Kontrast', 'Hall', 'Pööra 90°', 'Peegelda']);
  expect(document.activeElement).toBe(controls[0]);
});

test('photo_settings_menu_returns_focus_on_escape', async () => {
  await fixture();
  const { trigger, menu } = openSettings();
  const mirror = within(menu).getByRole('button', { name: 'Peegelda' });
  mirror.focus();
  fireEvent.keyDown(mirror, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Foto sätted' })).toBeNull();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger);
});

test('photo_settings_menu_consumes_escape_after_focus_leaves_menu', async () => {
  await fixture();
  const { trigger } = openSettings();
  const calibration = screen.getByRole('button', { name: 'Kalibreeri mõõtkava (K)' });
  const underlyingKeyHandler = vi.fn();
  window.addEventListener('keydown', underlyingKeyHandler);
  try {
    calibration.focus();
    expect(screen.getByRole('dialog', { name: 'Foto sätted' })).toBeTruthy();
    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    fireEvent(calibration, escape);
    expect(screen.queryByRole('dialog', { name: 'Foto sätted' })).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    expect(escape.defaultPrevented).toBe(true);
    expect(underlyingKeyHandler).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener('keydown', underlyingKeyHandler);
  }
});

test('photo_settings_menu_preserves_external_editable_escape', async () => {
  await fixture();
  openSettings();
  render(<input aria-label="Komponendi nimi" defaultValue="Muudetud nimi" />);
  const field = screen.getByRole('textbox', { name: 'Komponendi nimi' });
  field.focus();
  const escape = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  });
  fireEvent(field, escape);
  expect(escape.defaultPrevented).toBe(false);
  expect(document.activeElement).toBe(field);
  expect(screen.getByRole('dialog', { name: 'Foto sätted' })).toBeTruthy();
});

test.each(['native', 'aria'])('photo_settings_menu_preserves_%s_modal_escape', async (kind) => {
  await fixture();
  openSettings();
  render(
    kind === 'native' ? (
      <dialog open aria-label="Teine dialoog">
        <button>Dialoogi tegevus</button>
      </dialog>
    ) : (
      <div role="dialog" aria-modal="true" aria-label="Teine dialoog">
        <button>Dialoogi tegevus</button>
      </div>
    ),
  );
  const action = screen.getByRole('button', { name: 'Dialoogi tegevus' });
  action.focus();
  const escape = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
  });
  fireEvent(action, escape);
  expect(escape.defaultPrevented).toBe(false);
  expect(document.activeElement).toBe(action);
  expect(screen.getByRole('dialog', { name: 'Foto sätted' })).toBeTruthy();
});

test('photo_settings_menu_respects_escape_claimed_by_another_control', async () => {
  await fixture();
  openSettings();
  render(<button onKeyDown={(event) => event.preventDefault()}>Muu tegevus</button>);
  const action = screen.getByRole('button', { name: 'Muu tegevus' });
  action.focus();
  fireEvent.keyDown(action, { key: 'Escape' });
  expect(document.activeElement).toBe(action);
  expect(screen.getByRole('dialog', { name: 'Foto sätted' })).toBeTruthy();
});

test('photo_settings_menu_closes_on_outside_click', async () => {
  await fixture();
  const { trigger } = openSettings();
  const calibration = screen.getByRole('button', { name: 'Kalibreeri mõõtkava (K)' });
  calibration.focus();
  fireEvent.pointerDown(calibration);
  fireEvent.click(calibration);
  expect(screen.queryByRole('dialog', { name: 'Foto sätted' })).toBeNull();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(calibration);
  expect(useSessionStore.getState().toolId).toBe('photo.calibrate');
});

test('rotate_and_mirror_keep_menu_open', async () => {
  const { engine } = await fixture();
  const before = engine.snapshot();
  const { menu } = openSettings();
  const rotate = within(menu).getByRole('button', { name: 'Pööra 90°' });
  const mirror = within(menu).getByRole('button', { name: 'Peegelda' });
  for (const button of [rotate, rotate, mirror]) {
    button.focus();
    fireEvent.pointerDown(button);
    fireEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'Foto sätted' })).toBe(menu);
    expect(document.activeElement).toBe(button);
  }
  expect(engine.snapshot().rev).toBe(before.rev + 3);
  expect(engine.snapshot().doc.photos[0]?.transform).toBe('rot180');
});

test('photo_settings_menu_preserves_slider_limits_and_values', async () => {
  await fixture();
  const { menu } = openSettings();
  const opacity = within(menu).getByRole('slider', { name: 'Läbipaistvus' }) as HTMLInputElement;
  const contrast = within(menu).getByRole('slider', { name: 'Kontrast' }) as HTMLInputElement;
  for (const [slider, min, max] of [
    [opacity, '10', '100'],
    [contrast, '50', '200'],
  ] as const) {
    expect(slider.min).toBe(min);
    expect(slider.max).toBe(max);
    expect(slider.step).toBe('1');
    expect(slider.getAttribute('aria-valuetext')).toBe('100%');
    fireEvent.change(slider, { target: { value: min } });
    expect(slider.getAttribute('aria-valuetext')).toBe(`${min}%`);
    fireEvent.change(slider, { target: { value: max } });
    expect(slider.getAttribute('aria-valuetext')).toBe(`${max}%`);
  }
  expect(useViewStore.getState().modules.photo).toMatchObject({ opacity: 1, contrast: 2 });
});

test('photo_settings_menu_closes_when_photo_disappears_without_stale_reopen', async () => {
  const { engine, host } = await fixture();
  const before = engine.snapshot();
  openSettings();
  const withoutPhoto = structuredClone(before.doc) as BoardDoc;
  withoutPhoto.rev += 1;
  withoutPhoto.photos = [];
  delete withoutPhoto.activePhotoId;
  act(() => host.load(before.sessionId, withoutPhoto, false));
  expect(screen.queryByRole('dialog', { name: 'Foto sätted' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Foto sätted' })).toBeNull();
  act(() => host.load(before.sessionId, { ...before.doc, rev: before.rev + 2 } as BoardDoc, false));
  expect(screen.getByRole('button', { name: 'Foto sätted' }).getAttribute('aria-expanded')).toBe(
    'false',
  );
  expect(screen.queryByRole('dialog', { name: 'Foto sätted' })).toBeNull();
});

test('photo_settings_menu_closes_on_session_change_without_stale_reopen', async () => {
  const { engine, host } = await fixture();
  const before = engine.snapshot();
  openSettings();
  act(() => host.load('next-session', structuredClone(before.doc) as BoardDoc, false));
  expect(screen.queryByRole('dialog', { name: 'Foto sätted' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Foto sätted' }).getAttribute('aria-expanded')).toBe(
    'false',
  );
  act(() => host.load(before.sessionId, structuredClone(before.doc) as BoardDoc, false));
  expect(screen.queryByRole('dialog', { name: 'Foto sätted' })).toBeNull();
});
