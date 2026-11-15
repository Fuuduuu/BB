import { expect, test } from '@playwright/test';
import { bounds, canvas, center, createBoard } from './photo-flow-helpers';

test.use({ viewport: { width: 1280, height: 800 } });

test('navigator_tabs_fit_one_row_at_240_and_300px', async ({ page }) => {
  await createBoard(page, 'Navigaatori paigutuse katse');
  await page.getByRole('tab', { name: 'Teek', exact: true }).click();
  const library = page.getByRole('tabpanel', { name: 'Teek', exact: true });
  await library.getByRole('button', { name: 'SOIC', exact: true }).click();
  await library.getByRole('combobox', { name: 'Jalgade arv', exact: true }).selectOption('8');
  await library.getByRole('button', { name: 'Paiguta', exact: true }).click();
  const at = await center(canvas(page));
  await page.mouse.click(at.x, at.y);
  const pin = page.locator('[data-layer="components.pins"] [data-pin="3"]');
  const pinAt = await center(pin);
  await page.mouse.click(pinAt.x, pinAt.y);
  const voltage = page
    .getByRole('region', { name: 'Mõõda', exact: true })
    .getByRole('textbox', { name: 'Pinge', exact: true });
  await voltage.fill('4,98');
  await voltage.press('Enter');
  await expect(
    page.locator('[data-layer="measurements.readings"]').getByText('4,98 V', { exact: true }),
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Komponendid', exact: true }).click();
  const filters = page.getByRole('radiogroup', { name: 'Filter', exact: true });
  await filters.getByRole('radio', { name: 'Paigutamata (0)', exact: true }).click();
  await page.getByRole('button', { name: 'Lisa komponent', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Lisa komponent', exact: true });
  await dialog.getByRole('combobox', { name: 'Tüüp', exact: true }).selectOption('resistor');
  await dialog.getByRole('button', { name: 'Lisa komponent', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Vali R1', exact: true })).toBeVisible();
  await expect(page.locator('.pcbk-pane-summary')).toHaveText('1 plaadil · 1 paigutamata');
  await expect(filters.getByRole('radio', { name: 'Paigutamata (1)', exact: true })).toBeChecked();
  await filters.getByRole('radio', { name: 'Plaadil (1)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Vali U1', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  const handle = page.getByRole('separator', { name: 'Navigaatori laius', exact: true });
  await handle.focus();
  await handle.press('Home');
  for (const width of [240, 300]) {
    if (width === 300) {
      for (let step = 0; step < 6; step++) await handle.press('ArrowRight');
    }
    await expect(handle).toHaveAttribute('aria-valuenow', `${width}`);
    expect((await bounds(page.locator('.pcbk-navigator'))).width).toBe(width);
    const tabs = page.getByRole('tablist', { name: 'Navigaator', exact: true });
    for (const title of ['Teek', 'Komponendid', 'Mõõtmised']) {
      await expect(tabs.getByRole('tab', { name: title, exact: true })).toBeVisible();
    }
    await expect(filters).toBeVisible();
    await expect(page.locator('.pcbk-pane-summary')).toBeVisible();
    await expect(filters.locator('.pcbk-component-filters__dot')).toBeVisible();
    const layout = await tabs.evaluate((bar) => ({
      height: bar.getBoundingClientRect().height,
      buttons: Array.from(bar.querySelectorAll('button')).map((button) => ({
        label: button.textContent,
        y: button.getBoundingClientRect().y,
        scrollWidth: button.scrollWidth,
        clientWidth: button.clientWidth,
      })),
    }));
    expect.soft(layout.height, `${width}px: tab bar height`).toBeLessThanOrEqual(45);
    expect.soft(new Set(layout.buttons.map((button) => button.y)).size, `${width}px: rows`).toBe(1);
    expect
      .soft(
        layout.buttons.map((button) => button.label),
        `${width}px: full labels`,
      )
      .toEqual(['Teek', 'Komponendid', 'Mõõtmised']);
    for (const button of layout.buttons) {
      expect
        .soft(button.scrollWidth, `${width}px: ${button.label}`)
        .toBeLessThanOrEqual(button.clientWidth);
    }
  }
});
