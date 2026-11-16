import { expect, test } from '@playwright/test';
import {
  bounds,
  canvas,
  createBoard,
  dropPhoto,
  photo,
  syntheticPhoto,
} from './photo-flow-helpers';

test.use({ viewport: { width: 1100, height: 700 }, deviceScaleFactor: 1.25 });

test('bottom_bar_controls_fit_at_minimum_window_size', async ({ page }) => {
  await page.goto('/');
  for (const theme of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Välimus', exact: true }).selectOption(theme);
    await createBoard(page, `Alumise riba kontroll ${theme}`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await dropPhoto(page, canvas(page), await syntheticPhoto(page));
    await expect(photo(page)).toBeVisible();
    await page.getByRole('tab', { name: 'Teek', exact: true }).click();
    const library = page.getByRole('tabpanel', { name: 'Teek', exact: true });
    await library.getByRole('button', { name: 'Takisti SMD', exact: true }).click();
    await library.getByRole('button', { name: 'Paiguta', exact: true }).click();
    await canvas(page).click({ position: { x: 100, y: 100 } });
    await page.evaluate(() => document.fonts.ready);

    const header = await bounds(page.getByRole('banner'));
    const footer = page.getByRole('contentinfo', { name: 'Plaadi olek', exact: true });
    const bar = await bounds(footer);
    const pane = await bounds(page.getByRole('complementary', { name: 'Omadused', exact: true }));
    const viewport = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    expect(viewport.scrollWidth, `${theme}: no document horizontal scrolling`).toBeLessThanOrEqual(
      viewport.width,
    );
    expect(viewport.scrollHeight, `${theme}: no document vertical scrolling`).toBeLessThanOrEqual(
      viewport.height,
    );
    expect(bar.height).toBe(36);
    expect(pane.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(pane.y + pane.height).toBeLessThanOrEqual(bar.y);

    for (const control of await footer.locator('button, input[type="range"]').all()) {
      const box = await bounds(control);
      const name = (await control.getAttribute('aria-label')) ?? (await control.textContent());
      expect(box.x, `${theme}: ${name} left`).toBeGreaterThanOrEqual(bar.x);
      expect(box.y, `${theme}: ${name} top`).toBeGreaterThanOrEqual(bar.y);
      expect(box.x + box.width, `${theme}: ${name} right`).toBeLessThanOrEqual(
        Math.min(bar.x + bar.width, viewport.width),
      );
      expect(box.y + box.height, `${theme}: ${name} bottom`).toBeLessThanOrEqual(
        Math.min(bar.y + bar.height, viewport.height),
      );
    }

    const canvasBeforeMenu = await bounds(canvas(page));
    await footer.getByRole('button', { name: 'Foto sätted', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Foto sätted', exact: true });
    await expect(menu).toBeVisible();
    expect(await bounds(footer)).toEqual(bar);
    expect(await bounds(canvas(page))).toEqual(canvasBeforeMenu);

    for (const control of await menu.locator('button, input[type="range"]').all()) {
      const box = await bounds(control);
      const name = (await control.getAttribute('aria-label')) ?? (await control.textContent());
      expect(box.x, `${theme}: menu ${name} left`).toBeGreaterThanOrEqual(0);
      expect(box.y, `${theme}: menu ${name} top`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${theme}: menu ${name} right`).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height, `${theme}: menu ${name} bottom`).toBeLessThanOrEqual(
        viewport.height,
      );
    }
    await page.getByRole('button', { name: 'Tagasi avalehele', exact: true }).click();
  }
});

test('calibration_reached_in_two_tabs_from_photo_toggle', async ({ page }) => {
  await createBoard(page, 'Kalibreerimise otsetee');
  await dropPhoto(page, canvas(page), await syntheticPhoto(page));
  const toggle = page.getByRole('button', { name: 'Peida foto', exact: true });
  await toggle.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Kalibreeri mõõtkava (K)', exact: true }),
  ).toBeFocused();
});
