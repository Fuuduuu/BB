import { expect, test } from '@playwright/test';
import { bounds, canvas, center, createBoard } from './photo-flow-helpers';

test.use({ viewport: { width: 1100, height: 700 } });

test('second_pin_at_right_edge_is_selectable_with_context_hidden', async ({ page }) => {
  await createBoard(page, 'Parema serva jalgade valik');
  await page.getByRole('tab', { name: 'Teek', exact: true }).click();
  const library = page.getByRole('tabpanel', { name: 'Teek', exact: true });
  await library.getByRole('button', { name: 'SOIC', exact: true }).click();
  await library.getByRole('combobox', { name: 'Jalgade arv', exact: true }).selectOption('8');
  await library.getByRole('button', { name: 'Paiguta', exact: true }).click();
  const area = await bounds(canvas(page));
  await page.mouse.click(area.x + area.width - 80, area.y + 250);
  const pins = page.locator('[data-layer="components.pins"] [data-pin]');
  await expect(pins).toHaveCount(8);
  await page.keyboard.press('Escape');
  const component = await center(page.locator('[data-layer="components.bodies"] [data-component]'));
  await page.mouse.click(component.x, component.y);
  const pin3 = page.locator('[data-layer="components.pins"] [data-pin="3"]');
  const pin4 = page.locator('[data-layer="components.pins"] [data-pin="4"]');
  const at3 = await center(pin3);
  const at4 = await center(pin4);
  expect(at3.x).toBeGreaterThan(area.x + area.width - 280);
  expect(at4.x).toBeGreaterThan(area.x + area.width - 280);

  const context = page.getByRole('complementary', { name: 'Omadused', exact: true });
  await expect(context).toBeVisible();
  await page
    .locator('.pcbk-topbar')
    .getByRole('button', { name: 'Peida omadused', exact: true })
    .click();
  await expect(context).toHaveCount(0);

  // Real pointer coordinates exercise canvas hit testing, including any overlay obstruction.
  await page.mouse.click(at3.x, at3.y);
  await expect(pin3.locator('[stroke="var(--sel)"]')).toHaveCount(1);
  await page.mouse.click(at4.x, at4.y);
  await expect(context).toHaveCount(0);
  await expect(pin4.locator('[stroke="var(--sel)"]')).toHaveCount(1);
  await expect(pin3.locator('[stroke="var(--sel)"]')).toHaveCount(0);

  await canvas(page).focus();
  await page.keyboard.press('m');
  await expect(context).toBeVisible();
  await expect(context.getByRole('region', { name: 'Mõõda', exact: true })).toContainText('U1.4');
});
