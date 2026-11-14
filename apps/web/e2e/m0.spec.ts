import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { SAVE_MAX_WAIT_MS } from '../../../packages/domain/src/constants';

async function createBoard(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Uus plaat', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nimi', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Alusta', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}
async function addResistor(page: Page) {
  await page.getByRole('tab', { name: /^Plaadile paigutamata(?: \(\d+\))?$/ }).click();
  await page.getByRole('button', { name: 'Lisa komponent', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Lisa komponent' });
  await dialog.getByRole('combobox', { name: 'Tüüp' }).selectOption('resistor');
  await dialog.getByRole('button', { name: 'Lisa komponent', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Vali R1', exact: true })).toBeVisible();
}
test('M0 journey survives reload', async ({ page }) => {
  await createBoard(page, 'Minu toiteplaat');
  await addResistor(page);
  const ref = page.getByRole('textbox', { name: 'Tähis', exact: true });
  await ref.fill('R7');
  await ref.press('Enter');
  await ref.press('Tab');
  await expect(page.getByRole('button', { name: 'Vali R7', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Võta tagasi', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Vali R1', exact: true })).toBeVisible();
  await page.keyboard.press('Control+y');
  await expect(page.getByRole('button', { name: 'Vali R7', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Salvestatud' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Ava Minu toiteplaat', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Vali R7', exact: true })).toBeVisible();
});
test('new component has empty value and marking', async ({ page }) => {
  await createBoard(page, 'Tühi väärtus');
  await addResistor(page);
  await expect(page.getByRole('textbox', { name: 'Väärtus või mudel', exact: true })).toHaveValue(
    '',
  );
  await expect(page.getByRole('textbox', { name: 'Korpuse märgistus', exact: true })).toHaveValue(
    '',
  );
  await expect(
    page.getByRole('textbox', { name: 'Väärtus või mudel', exact: true }),
  ).toHaveAttribute('placeholder', /10/);
});
test('navigator width survives reload without any document command', async ({ page }) => {
  await createBoard(page, 'Vaate laius');
  const handle = page.getByRole('separator', { name: 'Navigaatori laius' });
  const box = await handle.boundingBox();
  if (!box) throw new Error('Resize handle is missing');
  await page.mouse.move(box.x + box.width / 2, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + 100);
  await page.mouse.up();
  await expect(handle).toHaveAttribute('aria-valuenow', '360');
  await expect(page.getByRole('button', { name: 'Võta tagasi', exact: true })).toBeDisabled();
  await expect(page.getByRole('status').filter({ hasText: 'Salvestatud' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Ava Vaate laius', exact: true }).click();
  await expect(page.getByRole('separator', { name: 'Navigaatori laius' })).toHaveAttribute(
    'aria-valuenow',
    '360',
  );
  await expect(page.getByRole('button', { name: 'Võta tagasi', exact: true })).toBeDisabled();
});
test('explicit discard after a storage error does not ask twice or silently save', async ({
  page,
}) => {
  await createBoard(page, 'Tõrke katse');
  await page.evaluate(() => {
    const state = window as typeof window & {
      __bbMarker: number;
      __bbPut: typeof IDBObjectStore.prototype.put;
    };
    state.__bbMarker = 1;
    state.__bbPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('Synthetic quota error', 'QuotaExceededError');
    };
  });
  await addResistor(page);
  await page.getByRole('button', { name: 'Tagasi avalehele', exact: true }).click();
  const close = page.getByRole('dialog', { name: /Viimaseid muudatusi ei õnnestunud salvestada/ });
  await expect(close).toBeVisible();
  let prompts = 0;
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'beforeunload') prompts++;
    await dialog.accept();
  });
  await close.getByRole('button', { name: 'Sulge salvestamata', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Uus plaat', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => (window as typeof window & { __bbMarker?: number }).__bbMarker),
  ).toBe(1);
  expect(prompts).toBe(0);
  await page.waitForTimeout(SAVE_MAX_WAIT_MS + 500);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = (
      window as typeof window & { __bbPut: typeof IDBObjectStore.prototype.put }
    ).__bbPut;
  });
  await page.reload();
  await page.getByRole('button', { name: 'Ava Tõrke katse', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tõrke katse', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vali R1', exact: true })).toHaveCount(0);
  expect(prompts).toBe(0);
});
test('stored projects remain discoverable when the recent index is absent', async ({ page }) => {
  await createBoard(page, 'Leitav plaat');
  await page.getByRole('button', { name: 'Tagasi avalehele', exact: true }).click();
  await page.evaluate(() => localStorage.removeItem('bb:recent-projects'));
  await page.reload();
  await page.getByRole('button', { name: 'Ava fail…', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Ava projekt' })
    .getByRole('button', { name: 'Ava Leitav plaat', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Leitav plaat', exact: true })).toBeVisible();
});
test('chosen theme stays active when returning to the start screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Välimus' }).selectOption('dark');
  await createBoard(page, 'Teema katse');
  await expect(page.getByRole('combobox', { name: 'Välimus' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tagasi avalehele', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Uus plaat', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
});
test('theme survives a full reload as a UI preference', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Välimus' }).selectOption('dark');
  await createBoard(page, 'Püsiv teema');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Uus plaat', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pcbk.theme'))).toBe('dark');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
});
test('context panel width and collapsed state survive reopening', async ({ page }) => {
  await createBoard(page, 'Paneeli mälu');
  await addResistor(page);
  const handle = page.getByRole('separator', { name: 'Omaduste paneeli laius' });
  await handle.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(handle).toHaveAttribute('aria-valuenow', '360');
  await page.getByRole('button', { name: 'Peida omadused', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Näita omadusi', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tagasi avalehele', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Uus plaat', exact: true })).toBeVisible();
  const savedViews = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bb-projects');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<unknown[]>((resolve, reject) => {
        const request = db.transaction('projects').objectStore('projects').getAll();
        request.onsuccess = () =>
          resolve(request.result.map((record: { view: unknown }) => record.view));
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  });
  expect(savedViews).toEqual([
    {
      navigatorWidth: 300,
      navigatorOpen: true,
      navigatorTab: 'unplaced',
      contextWidth: 360,
      contextOpen: false,
      boardView: { zoom: 1, pan: { x: 0, y: 0 } },
      modules: {},
    },
  ]);
  await page.reload();
  await page.getByRole('button', { name: 'Ava Paneeli mälu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Paneeli mälu', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Omadused', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Näita omadusi', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Omadused', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Vali R1', exact: true }).click();
  await expect(page.getByRole('separator', { name: 'Omaduste paneeli laius' })).toHaveAttribute(
    'aria-valuenow',
    '360',
  );
});
