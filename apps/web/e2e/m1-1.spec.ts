import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const canvas = (page: Page) =>
  page.getByRole('main', { name: 'Plaat', exact: true }).getByLabel('Plaat', { exact: true });
const body = (page: Page) => page.locator('[data-layer="components.bodies"] [data-component]');
const pin = (page: Page, id: string) =>
  page.locator(`[data-layer="components.pins"] [data-pin="${id}"]`);
const readings = (page: Page) => page.locator('[data-layer="measurements.readings"]');
const measure = (page: Page) => page.getByRole('region', { name: 'Mõõda', exact: true });
const voltage = (page: Page) => measure(page).getByRole('textbox', { name: 'Pinge', exact: true });
const undo = (page: Page) => page.getByRole('button', { name: 'Võta tagasi', exact: true });
const saved = (page: Page) => page.getByRole('status').filter({ hasText: 'Salvestatud' });

async function createBoard(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Uus plaat', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nimi', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Alusta', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

async function closeAndReopen(page: Page, name: string) {
  await page.getByRole('button', { name: 'Tagasi avalehele', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Uus plaat', exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Ava ${name}`, exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

async function center(target: Locator) {
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  if (!box) throw new Error('Visible element has no bounding box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function placeSoic(page: Page) {
  await page.getByRole('tab', { name: 'Teek', exact: true }).click();
  const library = page.getByRole('tabpanel', { name: 'Teek', exact: true });
  await library.getByRole('button', { name: 'SOIC', exact: true }).click();
  await library.getByRole('combobox', { name: 'Jalgade arv', exact: true }).selectOption('8');
  await library.getByRole('button', { name: 'Paiguta', exact: true }).click();
  const { x, y } = await center(canvas(page));
  await page.mouse.click(x, y);
  await expect(body(page)).toBeVisible();
  await expect(page.locator('[data-layer="components.pins"] [data-pin]')).toHaveCount(8);
}

async function clickPin(page: Page, id: string) {
  const { x, y } = await center(pin(page, id));
  await page.mouse.click(x, y);
  await expect(measure(page).getByText(`U1.${id}`, { exact: true })).toBeVisible();
}

async function saveVoltage(page: Page) {
  await voltage(page).fill('4,98');
  await voltage(page).press('Enter');
  await expect(readings(page).getByText('4,98 V', { exact: true })).toBeVisible();
}

test('first_through_flow_measurement_survives_reopen', async ({ page }) => {
  const name = 'Esimene mõõtmine';
  await createBoard(page, name);
  await placeSoic(page);
  await clickPin(page, '3');
  await saveVoltage(page);
  await expect(saved(page)).toBeVisible();

  await closeAndReopen(page, name);
  const reading = readings(page).getByText('4,98 V', { exact: true });
  const ring = await center(reading.locator('..').locator('circle'));
  const measuredPin = await center(pin(page, '3'));
  expect(ring.x).toBeCloseTo(measuredPin.x, 1);
  expect(ring.y).toBeCloseTo(measuredPin.y, 1);
  await expect(reading).toBeVisible();

  await page.getByRole('tab', { name: 'Mõõtmised (1)', exact: true }).click();
  const row = page
    .getByRole('tabpanel', { name: 'Mõõtmised (1)', exact: true })
    .getByRole('listitem');
  await expect(row.getByText('U1.3', { exact: true })).toBeVisible();
  await expect(row.getByText('4,98 V', { exact: true })).toBeVisible();
});

test('unsaved_text_does_not_follow_alt_down', async ({ page }) => {
  await createBoard(page, 'Jalalt jalale');
  await placeSoic(page);
  await clickPin(page, '3');
  await voltage(page).fill('5');

  await page.keyboard.press('Alt+ArrowDown');
  await expect(measure(page).getByText('U1.4', { exact: true })).toBeVisible();
  await expect(voltage(page)).toHaveValue('');
  await expect(voltage(page)).toBeFocused();

  await page.keyboard.press('Alt+ArrowUp');
  await expect(measure(page).getByText('U1.3', { exact: true })).toBeVisible();
  await expect(voltage(page)).toHaveValue('5');
  await expect(page.getByRole('tab', { name: 'Mõõtmised', exact: true })).toBeVisible();
});

test('blank_click_and_tab_keep_measure_location', async ({ page }) => {
  await createBoard(page, 'Mõõtmiskoha mälu');
  await placeSoic(page);
  await clickPin(page, '3');
  await voltage(page).fill('4,98');

  const componentRef = page.getByRole('textbox', { name: 'Tähis', exact: true });
  await expect(componentRef).toBeVisible();
  await canvas(page).click({ position: { x: 30, y: 30 } });
  await expect(componentRef).toHaveCount(0);
  await expect(measure(page).getByText('U1.3', { exact: true })).toBeVisible();
  await expect(voltage(page)).toHaveValue('4,98');

  const measurementsTab = page.getByRole('tab', { name: 'Mõõtmised', exact: true });
  await measurementsTab.click();
  await expect(measurementsTab).toHaveAttribute('aria-selected', 'true');
  await expect(measure(page).getByText('U1.3', { exact: true })).toBeVisible();
  await expect(voltage(page)).toHaveValue('4,98');
});

test('tab_does_not_change_location', async ({ page }) => {
  await createBoard(page, 'Tabulaator mõõtmisel');
  await placeSoic(page);
  await clickPin(page, '3');
  await voltage(page).fill('4,98');

  await voltage(page).press('Tab');
  await expect(measure(page).getByRole('button', { name: 'Salvesta', exact: true })).toBeFocused();
  await expect(measure(page).getByText('U1.3', { exact: true })).toBeVisible();
  await expect(voltage(page)).toHaveValue('4,98');
});

test('drag_with_escape_leaves_no_trace', async ({ page }) => {
  await createBoard(page, 'Katkestatud lohistamine');
  await placeSoic(page);
  await expect(saved(page)).toBeVisible();
  const saveStatus = await saved(page).innerText();
  await expect(undo(page)).toBeEnabled();

  const initial = await center(body(page));
  await page.mouse.move(initial.x, initial.y);
  await page.mouse.down();
  await page.mouse.move(initial.x + 90, initial.y + 55, { steps: 5 });
  expect(await center(body(page))).not.toEqual(initial);
  await page.keyboard.press('Escape');
  await page.mouse.up();

  expect(await center(body(page))).toEqual(initial);
  await expect(undo(page)).toBeEnabled();
  await expect(saved(page)).toHaveText(saveStatus);
  await undo(page).click();
  await expect(body(page)).toHaveCount(0);
  await expect(undo(page)).toBeDisabled();
});

test('undo_redo_of_placement_and_measurement', async ({ page }) => {
  await createBoard(page, 'Paigutuse ja mõõtmise ajalugu');
  await placeSoic(page);
  const placedAt = await center(body(page));
  await clickPin(page, '3');
  await saveVoltage(page);

  await undo(page).click();
  await expect(readings(page).getByText('4,98 V', { exact: true })).toHaveCount(0);
  await expect(body(page)).toBeVisible();
  await undo(page).click();
  await expect(body(page)).toHaveCount(0);
  await expect(undo(page)).toBeDisabled();

  const redo = page.getByRole('button', { name: 'Tee uuesti', exact: true });
  await redo.click();
  expect(await center(body(page))).toEqual(placedAt);
  await expect(readings(page).getByText('4,98 V', { exact: true })).toHaveCount(0);
  await redo.click();
  await expect(readings(page).getByText('4,98 V', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Mõõtmised (1)', exact: true }).click();
  await expect(page.getByRole('listitem').getByText('U1.3', { exact: true })).toBeVisible();
});

test('board_zoom_pan_survive_view_only_close_and_reopen', async ({ page }) => {
  const name = 'Lõuendi vaade';
  await createBoard(page, name);
  const view = canvas(page).locator('[data-view]');
  const viewPosition = () =>
    view.evaluate((group: SVGGElement) => {
      const { a, e, f } = group.transform.baseVal.getItem(0).matrix;
      return { zoom: a, x: e, y: f };
    });
  await expect.poll(viewPosition).toEqual({ zoom: 1, x: 0, y: 0 });

  const { x, y } = await center(canvas(page));
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -200);
  await expect.poll(async () => (await viewPosition()).zoom).toBeGreaterThan(1);
  const zoomed = await viewPosition();

  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(x + 80, y + 50, { steps: 5 });
  await page.mouse.up({ button: 'middle' });
  const panned = await viewPosition();
  expect(panned.zoom).toBe(zoomed.zoom);
  expect(panned.x - zoomed.x).toBeCloseTo(80, 1);
  expect(panned.y - zoomed.y).toBeCloseTo(50, 1);
  await expect(undo(page)).toBeDisabled();

  await closeAndReopen(page, name);
  await expect.poll(viewPosition).toEqual(panned);
  await expect(undo(page)).toBeDisabled();
});
