import { expect, test } from '@playwright/test';
import {
  bounds,
  canvas,
  center,
  createBoard,
  dropPhoto,
  photo,
  reopen,
  screenshotMarks,
  syntheticPhoto,
  undo,
} from './photo-flow-helpers';

test('exif_portrait_is_upright_on_canvas', async ({ page }) => {
  await page.goto('/');
  await dropPhoto(
    page,
    page.getByText('Lohista plaadi foto siia või kleebi Ctrl+V', { exact: true }),
    await syntheticPhoto(page, true),
  );
  await expect(page.getByRole('heading', { name: 'portree', exact: true })).toBeVisible();
  const box = await bounds(photo(page));
  expect(box.height).toBeGreaterThan(box.width);
  const [red, blue] = await screenshotMarks(page);
  expect(red!.x).toBeLessThan(box.x + box.width / 2);
  expect(red!.y).toBeLessThan(box.y + box.height / 2);
  // Independent EXIF expectation: (H-y,x), applied once, plus DOM photo origin.
  expect(red!.x - box.x).toBeCloseTo(58, 0);
  expect(red!.y - box.y).toBeCloseTo(72, 0);
  expect(blue!.x - box.x).toBeCloseTo(238, 0);
  expect(blue!.y - box.y).toBeCloseTo(302, 0);
});

test('calibration_shows_scale_and_undo_restores', async ({ page }) => {
  await createBoard(page, 'Mõõtkava kontroll');
  const area = await bounds(canvas(page));
  await canvas(page).focus();
  await page.keyboard.press('k');
  await page.mouse.click(area.x + 100, area.y + 100);
  await page.mouse.click(area.x + 200, area.y + 100);
  const mm = page.getByRole('textbox', { name: 'Vahe millimeetrites', exact: true });
  await mm.fill('10');
  await mm.press('Enter');
  const scale = page.getByRole('button', { name: 'Kalibreeri mõõtkava (K)', exact: true });
  await expect(scale).toHaveText('10,00 px/mm');
  await expect(page.getByText('Kalibreerimata', { exact: true })).toHaveCount(0);
  await undo(page).click();
  await expect(scale).toHaveText('Kalibreerimata');
});

test('pin_stays_on_photo_mark_after_rotate_and_mirror', async ({ page }) => {
  await createBoard(page, 'Jalg ja orientiir');
  await dropPhoto(page, canvas(page), await syntheticPhoto(page));
  const initialPhoto = await bounds(photo(page));
  const [mark] = await screenshotMarks(page);
  expect(mark!.x - initialPhoto.x).toBeCloseTo(220, 0);
  expect(mark!.y - initialPhoto.y).toBeCloseTo(190, 0);
  await page.getByRole('tab', { name: 'Teek', exact: true }).click();
  const library = page.getByRole('tabpanel', { name: 'Teek', exact: true });
  await library.getByRole('button', { name: 'Takisti SMD', exact: true }).click();
  await library.getByRole('button', { name: 'Paiguta', exact: true }).click();
  await page.mouse.click(mark!.x, mark!.y);
  const body = page.locator('[data-layer="components.bodies"] [data-component]');
  const pin = page.locator('[data-layer="components.pins"] [data-pin="1"]');
  const bodyAt = await center(body);
  const pinAt = await center(pin);
  await page.mouse.move(bodyAt.x, bodyAt.y);
  await page.mouse.down();
  await page.mouse.move(bodyAt.x + mark!.x - pinAt.x, bodyAt.y + mark!.y - pinAt.y, { steps: 5 });
  await page.mouse.up();
  for (const action of [null, 'Pööra 90°', 'Peegelda']) {
    if (action) await page.getByRole('button', { name: action, exact: true }).click();
    const [red] = await screenshotMarks(page);
    const foot = await center(pin);
    expect(
      Math.hypot(foot.x - red!.x, foot.y - red!.y),
      action ?? 'before transform',
    ).toBeLessThanOrEqual(3);
  }
});

test('add_photo_to_board_without_photo', async ({ page }) => {
  await createBoard(page, 'Foto lisamine');
  await expect(photo(page)).toHaveCount(0);
  const file = await syntheticPhoto(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Lisa foto', exact: true }).click();
  await (await chooser).setFiles(file);
  await expect(photo(page)).toBeVisible();
  await expect(photo(page)).toHaveAttribute('width', '800');
  await expect(photo(page)).toHaveAttribute('height', '600');
  const workSurface = canvas(page).locator('[data-scene] > rect');
  await expect(workSurface).toHaveAttribute('width', '800');
  await expect(workSurface).toHaveAttribute('height', '600');
});

test('broken_image_leaves_no_photo_reference', async ({ page }) => {
  const name = 'Katkine foto';
  await createBoard(page, name);
  const undoBefore = await undo(page).isEnabled();
  const good = await syntheticPhoto(page, true);
  await dropPhoto(page, canvas(page), {
    ...good,
    name: 'katkine.jpg',
    buffer: good.buffer.subarray(0, 80),
  });
  await expect(page.getByRole('alert')).toContainText('Fotot ei saanud lisada');
  await expect(photo(page)).toHaveCount(0);
  expect(await undo(page).isEnabled()).toBe(undoBefore);
  await reopen(page, name);
  await expect(photo(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lisa foto', exact: true })).toBeVisible();
  await expect(undo(page)).toBeDisabled();
});

test('photo_and_view_settings_survive_reopen', async ({ page }) => {
  const name = 'Foto vaate mälu';
  await createBoard(page, name);
  await dropPhoto(page, canvas(page), await syntheticPhoto(page));
  const original = await bounds(photo(page));
  const opacity = page.getByRole('slider', { name: 'Läbipaistvus', exact: true });
  await opacity.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight', { delay: 0 });
  for (let value = 11; value < 50; value++) await page.keyboard.press('ArrowRight');
  await expect(opacity).toHaveValue('50');
  await page.getByRole('button', { name: 'Hall', exact: true }).click();
  await page.getByRole('button', { name: 'Pööra 90°', exact: true }).click();
  const rotated = await bounds(photo(page));
  expect(rotated.width).toBeCloseTo(original.height, 1);
  expect(rotated.height).toBeCloseTo(original.width, 1);
  await reopen(page, name);
  await expect(photo(page)).toBeVisible();
  await expect(opacity).toHaveValue('50');
  await expect(page.getByRole('button', { name: 'Hall', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(photo(page)).toHaveCSS('opacity', '0.5');
  await expect(photo(page)).toHaveCSS('filter', 'contrast(1) grayscale(1)');
  const reopened = await bounds(photo(page));
  expect(reopened).toEqual(rotated);

  // The SVG bounds and settings survive even when its image URL is broken.
  // After proving their persistence, restore full colour to measure actual pixels.
  await page.getByRole('button', { name: 'Hall', exact: true }).click();
  await opacity.focus();
  await page.keyboard.press('End');
  await expect(opacity).toHaveValue('100');
  const [red, blue] = await screenshotMarks(page);
  // Independent clockwise rotation: (x,y) -> (600-y,x).
  expect(red!.x - reopened.x).toBeCloseTo(410, 0);
  expect(red!.y - reopened.y).toBeCloseTo(220, 0);
  expect(blue!.x - reopened.x).toBeCloseTo(150, 0);
  expect(blue!.y - reopened.y).toBeCloseTo(650, 0);
});
