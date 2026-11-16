import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  bounds,
  canvas,
  center,
  dropPhoto,
  photo,
  reopen,
  screenshotMarks,
  syntheticPhoto,
} from './photo-flow-helpers';

const properties = (page: Page) =>
  page.getByRole('complementary', { name: 'Omadused', exact: true });
const readings = (page: Page) => page.locator('[data-layer="measurements.readings"]');
const pins = (page: Page, componentId: string) =>
  page.locator(`[data-layer="components.pins"] [data-component="${componentId}"] [data-pin]`);
const pin = (page: Page, componentId: string, pinId: string) =>
  page.locator(
    `[data-layer="components.pins"] [data-component="${componentId}"] [data-pin="${pinId}"]`,
  );

async function componentId(page: Page, ref: string) {
  const label = page
    .locator('[data-layer="components.labels"] text')
    .filter({ hasText: new RegExp(`^${ref}(?: \\?)?$`) });
  await expect(label).toBeVisible();
  const id = await label.evaluate((element) =>
    element.closest('[data-component]')!.getAttribute('data-component'),
  );
  if (!id) throw new Error(`Rendered component ${ref} has no id`);
  return id;
}

async function clickPin(page: Page, id: string, pinId: string) {
  const at = await center(pin(page, id, pinId));
  await page.mouse.click(at.x, at.y);
}

async function saveVoltage(page: Page, value: string) {
  const input = page
    .getByRole('region', { name: 'Mõõda', exact: true })
    .getByRole('textbox', { name: 'Pinge', exact: true });
  await input.fill(value);
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await expect(readings(page).getByText(`${value} V`, { exact: true })).toBeVisible();
}

async function choosePackage(page: Page, id: string, count: string) {
  const body = page.locator(`[data-layer="components.bodies"] [data-component="${id}"]`);
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

test('m1_3_technician_flow', async ({ page }) => {
  await page.goto('/');
  await dropPhoto(
    page,
    page.getByText('Lohista plaadi foto siia või kleebi Ctrl+V', { exact: true }),
    await syntheticPhoto(page),
  );
  await expect(page.getByRole('heading', { name: 'orientiirid', exact: true })).toBeVisible();
  await expect(photo(page)).toBeVisible();

  const library = page.getByRole('tabpanel', { name: 'Teek', exact: true });
  await library.getByRole('button', { name: 'SOIC', exact: true }).click();
  await library.getByRole('combobox', { name: 'Jalgu', exact: true }).selectOption('8');
  await library.getByRole('button', { name: 'Paiguta', exact: true }).click();
  const area = await bounds(canvas(page));
  await page.mouse.click(area.x + 200, area.y + 250);
  await page.mouse.click(area.x + 450, area.y + 250);
  const bodies = page.locator('[data-layer="components.bodies"] [data-component]');
  await expect(bodies).toHaveCount(2);
  await page.keyboard.press('Escape');
  await page.mouse.click(area.x + 100, area.y + 100);
  await expect(bodies).toHaveCount(2);
  const u1 = await componentId(page, 'U1');
  const u2 = await componentId(page, 'U2');
  await expect(pins(page, u1)).toHaveCount(8);
  await expect(pins(page, u2)).toHaveCount(8);

  const u1At = await center(
    page.locator(`[data-layer="components.bodies"] [data-component="${u1}"]`),
  );
  await page.mouse.click(u1At.x, u1At.y);
  await expect(properties(page)).toBeVisible();
  const topbar = page.locator('.pcbk-topbar');
  await topbar.getByRole('button', { name: 'Peida omadused', exact: true }).click();
  await clickPin(page, u1, '3');
  await expect(properties(page)).toHaveCount(0);
  await expect(pin(page, u1, '3').locator('[stroke="var(--sel)"]')).toHaveCount(1);
  await clickPin(page, u2, '4');
  await expect(properties(page)).toHaveCount(0);
  await expect(pin(page, u2, '4').locator('[stroke="var(--sel)"]')).toHaveCount(1);
  await expect(pins(page, u1).locator('[stroke="var(--sel)"]')).toHaveCount(0);

  await canvas(page).focus();
  await page.keyboard.press('m');
  const measure = page.getByRole('region', { name: 'Mõõda', exact: true });
  const red = measure.getByRole('group', { name: 'Punane sond', exact: true });
  const black = measure.getByRole('group', { name: 'Must sond', exact: true });
  await expect(properties(page)).toBeVisible();
  await expect(red).toContainText('U2.4');
  await black.getByRole('button', { name: 'Vali musta sondi jalg', exact: true }).click();
  await clickPin(page, u1, '4');
  await expect(red).toContainText('U2.4');
  await expect(black).toContainText('U1.4');
  await saveVoltage(page, '4,73');
  await expect(measure.locator('.pcbk-last-saved')).toContainText('U2.4 → U1.4');

  await choosePackage(page, u1, '14');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(pins(page, u1)).toHaveCount(14);
  await expect(readings(page).getByText('4,73 V', { exact: true })).toBeVisible();
  await clickPin(page, u1, '12');
  await expect(red).toContainText('U1.12');
  await black.getByRole('button', { name: 'Tühjenda', exact: true }).click();
  await expect(black).toContainText('määramata');
  await saveVoltage(page, '3,3');
  await expect(measure.locator('.pcbk-last-saved')).toContainText('U1.12');
  await expect(measure.locator('.pcbk-last-saved')).not.toContainText('→');

  await choosePackage(page, u1, '8');
  const dialog = page.getByRole('dialog', { name: 'Korpuse vahetus', exact: true });
  await expect(dialog).toContainText('Kaovad jalad 9–14: 1 mõõtmine.');
  await expect(dialog).toContainText('Mõõtmised jäävad ajaloolistena alles.');
  await expect(pins(page, u1)).toHaveCount(14);
  await dialog.getByRole('button', { name: 'Vaheta korpus', exact: true }).click();
  await expect(pins(page, u1)).toHaveCount(8);
  await expect(readings(page).getByText('4,73 V', { exact: true })).toBeVisible();
  await expect(readings(page).getByText('3,3 V', { exact: true })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Mõõtmised', exact: true }).click();
  const rows = page.getByRole('tabpanel', { name: 'Mõõtmised', exact: true }).getByRole('listitem');
  const original = rows.filter({ has: page.getByText('U2.4', { exact: true }) });
  const added = rows.filter({ has: page.getByText('U1.12', { exact: true }) });
  await expect(rows).toHaveCount(2);
  await expect(original).toContainText('4,73 V');
  await expect(original).toContainText('U1.4');
  await expect(original.getByText('kontakt kustutatud', { exact: true })).toHaveCount(0);
  await expect(added).toContainText('3,3 V');
  await expect(added.getByText('kontakt kustutatud', { exact: true })).toBeVisible();

  await canvas(page).click({ position: { x: 25, y: 25 } });
  await page.keyboard.press('Control+z');
  await expect(pins(page, u1)).toHaveCount(14);
  await expect(added.getByText('kontakt kustutatud', { exact: true })).toHaveCount(0);
  await expect(readings(page).getByText('3,3 V', { exact: true })).toBeVisible();
  await expect(readings(page).getByText('4,73 V', { exact: true })).toBeVisible();

  await topbar.getByRole('button', { name: 'Peida omadused', exact: true }).click();
  await topbar.getByRole('button', { name: 'Peida navigaator', exact: true }).click();
  await page.getByRole('button', { name: 'Vähenda', exact: true }).click();
  const view = await canvas(page).locator('[data-view]').getAttribute('transform');
  const photoBounds = await bounds(photo(page));
  const marks = await screenshotMarks(page);
  await reopen(page, 'orientiirid');
  await expect(properties(page)).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Navigaator', exact: true })).toHaveCount(0);
  await expect(canvas(page).locator('[data-view]')).toHaveAttribute('transform', view!);
  await expect(photo(page)).toHaveAttribute('width', '800');
  await expect(photo(page)).toHaveAttribute('height', '600');
  expect(await bounds(photo(page))).toEqual(photoBounds);
  expect(await screenshotMarks(page)).toEqual(marks);
  await expect(bodies).toHaveCount(2);
  expect(await componentId(page, 'U1')).toBe(u1);
  expect(await componentId(page, 'U2')).toBe(u2);
  await expect(pins(page, u1)).toHaveCount(14);
  await expect(pins(page, u2)).toHaveCount(8);
  await expect(readings(page).getByText('4,73 V', { exact: true })).toBeVisible();
  await expect(readings(page).getByText('3,3 V', { exact: true })).toBeVisible();
  await topbar.getByRole('button', { name: 'Näita navigaatorit', exact: true }).click();
  await expect(rows).toHaveCount(2);
  await expect(original).toContainText('4,73 V');
  await expect(original).toContainText('U1.4');
  await expect(added).toContainText('3,3 V');
  await expect(rows.getByText('kontakt kustutatud', { exact: true })).toHaveCount(0);
  await clickPin(page, u2, '4');
  await expect(pin(page, u2, '4').locator('[stroke="var(--sel)"]')).toHaveCount(1);
  await expect(properties(page)).toHaveCount(0);
});
