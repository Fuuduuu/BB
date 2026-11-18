import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { canvasViewport, center, createBoard } from './photo-flow-helpers';

const pins = (page: Page) => page.locator('[data-layer="components.pins"] [data-pin]');
const readings = (page: Page) => page.locator('[data-layer="measurements.readings"]');
const properties = (page: Page) =>
  page.getByRole('complementary', { name: 'Omadused', exact: true });

async function saveVoltage(page: Page, pinId: string, value: string) {
  const at = await center(page.locator(`[data-layer="components.pins"] [data-pin="${pinId}"]`));
  await page.mouse.click(at.x, at.y);
  const measure = page.getByRole('region', { name: 'Mõõda', exact: true });
  await expect(measure.getByText(`U1.${pinId}`, { exact: true })).toBeVisible();
  const input = measure.getByRole('textbox', { name: 'Pinge', exact: true });
  await input.fill(value);
  await input.press('Enter');
  await expect(readings(page).getByText(`${value} V`, { exact: true })).toBeVisible();
}

async function choosePackage(page: Page, count: string) {
  const body = page.locator('[data-layer="components.bodies"] [data-component]');
  const at = await center(body);
  await page.mouse.click(at.x, at.y);
  const summary = properties(page).locator('summary').filter({ hasText: 'Korpus' });
  if ((await summary.locator('..').getAttribute('open')) === null) await summary.click();
  await properties(page).getByRole('button', { name: 'Muuda', exact: true }).click();
  const editor = properties(page).getByRole('region', { name: 'Korpuse valik', exact: true });
  await editor.getByRole('combobox', { name: 'Vali korpus', exact: true }).selectOption('soic');
  await editor.getByRole('combobox', { name: 'Jalgu', exact: true }).selectOption(count);
  await editor.getByRole('button', { name: 'Vaheta korpus', exact: true }).click();
}

test('soic8_14_8_swap_keeps_and_historizes_measurements', async ({ page }) => {
  await createBoard(page, 'Korpuse vahetuse mõõtmised');
  await page.getByRole('tab', { name: 'Teek', exact: true }).click();
  const library = page.getByRole('tabpanel', { name: 'Teek', exact: true });
  await library.getByRole('button', { name: 'SOIC', exact: true }).click();
  await library.getByRole('combobox', { name: 'Jalgu', exact: true }).selectOption('8');
  await library.getByRole('button', { name: 'Paiguta', exact: true }).click();
  const at = await center(canvasViewport(page));
  await page.mouse.click(at.x, at.y);
  await expect(pins(page)).toHaveCount(8);
  await page.keyboard.press('Escape');
  await saveVoltage(page, '3', '4,98');

  await choosePackage(page, '14');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(pins(page)).toHaveCount(14);
  await expect(readings(page).getByText('4,98 V', { exact: true })).toBeVisible();
  await saveVoltage(page, '12', '3,3');

  await choosePackage(page, '8');
  const dialog = page.getByRole('dialog', { name: 'Korpuse vahetus', exact: true });
  await expect(dialog).toContainText('Kaovad jalad 9–14: 1 mõõtmine.');
  await expect(dialog).toContainText('Mõõtmised jäävad ajaloolistena alles.');
  await expect(pins(page)).toHaveCount(14);
  await dialog.getByRole('button', { name: 'Vaheta korpus', exact: true }).click();
  await expect(pins(page)).toHaveCount(8);
  await expect(readings(page).getByText('4,98 V', { exact: true })).toBeVisible();
  await expect(readings(page).getByText('3,3 V', { exact: true })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Mõõtmised', exact: true }).click();
  const rows = page.getByRole('tabpanel', { name: 'Mõõtmised', exact: true }).getByRole('listitem');
  const pin3 = rows.filter({ has: page.getByText('U1.3', { exact: true }) });
  const pin12 = rows.filter({ has: page.getByText('U1.12', { exact: true }) });
  await expect(rows).toHaveCount(2);
  await expect(pin3).toContainText('4,98 V');
  await expect(pin3.getByText('kontakt kustutatud', { exact: true })).toHaveCount(0);
  await expect(pin12).toContainText('3,3 V');
  await expect(pin12.getByText('kontakt kustutatud', { exact: true })).toBeVisible();

  await canvasViewport(page).click({ position: { x: 25, y: 25 } });
  await page.keyboard.press('Control+z');
  await expect(pins(page)).toHaveCount(14);
  await expect(pin12.getByText('kontakt kustutatud', { exact: true })).toHaveCount(0);
  await expect(readings(page).getByText('3,3 V', { exact: true })).toBeVisible();
  await expect(readings(page).getByText('4,98 V', { exact: true })).toBeVisible();
});
