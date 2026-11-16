import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { BoardDoc } from '@pcbk/domain';
import {
  bounds,
  canvas,
  center,
  createBoard,
  dropPhoto,
  photo,
  syntheticPhoto,
} from './photo-flow-helpers';

test.use({ viewport: { width: 1280, height: 800 } });

function textBounds(text: Locator) {
  return text.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  });
}

async function expectSeparated(page: Page) {
  const label = page.locator('[data-layer="components.labels"] text').filter({ hasText: 'J29' });
  const value = page
    .locator('[data-layer="components.labels"] text')
    .filter({ hasText: 'LONG CONNECTOR VALUE' });
  const reading = page
    .locator('[data-layer="measurements.readings"] text')
    .filter({ hasText: '3,651 V' });
  await expect(label).toBeVisible();
  await expect(value).toBeVisible();
  await expect(reading).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const componentId = await label.evaluate((element) =>
    element.closest('[data-component]')!.getAttribute('data-component'),
  );
  const numbers = page
    .locator(`[data-layer="components.labels"] [data-component="${componentId}"] text`)
    .filter({ hasText: /^\d+$/ });
  await expect(numbers).toHaveCount(15);
  await expect
    .poll(async () => {
      const a = await textBounds(label);
      const b = await textBounds(reading);
      return (
        Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
        Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
      );
    })
    .toBe(0);
  const textBoxes = await Promise.all([textBounds(label), textBounds(value)]);
  for (const number of await numbers.all()) {
    const pinBox = await textBounds(number);
    for (const textBox of textBoxes) {
      expect(
        Math.max(
          0,
          Math.min(textBox.x + textBox.width, pinBox.x + pinBox.width) -
            Math.max(textBox.x, pinBox.x),
        ) *
          Math.max(
            0,
            Math.min(textBox.y + textBox.height, pinBox.y + pinBox.height) -
              Math.max(textBox.y, pinBox.y),
          ),
        `Automatic reference/value must clear pin ${await number.textContent()}`,
      ).toBe(0);
    }
  }
}

test('j29_reading_does_not_overlap_ref_label', async ({ page }) => {
  await createBoard(page, 'J29 siltide kontroll');
  await page.getByRole('tab', { name: 'Teek', exact: true }).click();
  const library = page.getByRole('tabpanel', { name: 'Teek', exact: true });
  await library.getByRole('button', { name: 'Pinnirida 1×N', exact: true }).click();
  await library.getByRole('textbox', { name: 'Jalgu', exact: true }).fill('15');
  await library.getByRole('button', { name: 'Paiguta', exact: true }).click();
  // The photo transform loop below covers all eight directions of the committed pin row.
  await page.keyboard.press('r');
  await page.keyboard.press('r');
  await page.keyboard.press('r');
  const area = await bounds(canvas(page));
  await page.mouse.click(area.x + 320, area.y + 320);
  await expect(page.locator('[data-layer="components.pins"] [data-pin]')).toHaveCount(15);
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Komponendid', exact: true }).click();
  await page.getByRole('button', { name: 'Vali J1', exact: true }).click();
  const ref = page.getByRole('textbox', { name: 'Tähis', exact: true });
  await ref.fill('J29');
  await ref.press('Enter');
  const value = page.getByRole('textbox', { name: 'Väärtus või mudel', exact: true });
  await value.fill('LONG CONNECTOR VALUE');
  await value.press('Enter');
  const pin = await center(page.locator('[data-layer="components.pins"] [data-pin="15"]'));
  await page.mouse.click(pin.x, pin.y);
  const input = page
    .getByRole('region', { name: 'Mõõda', exact: true })
    .getByRole('textbox', { name: 'Pinge', exact: true });
  await input.fill('3,651');
  await input.press('Enter');
  await expect(page.getByText('100 %', { exact: true })).toBeVisible();
  await expectSeparated(page);
  await dropPhoto(page, canvas(page), await syntheticPhoto(page));
  await expect(photo(page)).toBeVisible();
  await expect(photo(page)).toHaveAttribute('width', '800');
  const scene = canvas(page).locator('[data-scene]');
  const matrices = new Set([await scene.getAttribute('transform')]);
  await expectSeparated(page);
  // The four rotations, followed by reflection and four rotations, cover all eight scenes.
  for (const action of [
    'Pööra 90°',
    'Pööra 90°',
    'Pööra 90°',
    'Peegelda',
    'Pööra 90°',
    'Pööra 90°',
    'Pööra 90°',
  ]) {
    const before = await scene.getAttribute('transform');
    await page.getByRole('button', { name: 'Foto sätted', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Foto sätted', exact: true })
      .getByRole('button', { name: action, exact: true })
      .click();
    await page.keyboard.press('Escape');
    await expect.poll(() => scene.getAttribute('transform')).not.toBe(before);
    matrices.add(await scene.getAttribute('transform'));
    await expectSeparated(page);
  }
  expect(matrices.size).toBe(8);
});

test('adjacent_readings_do_not_overlap', async ({ page }) => {
  const name = 'Kõrvutiste näitude kontroll';
  await createBoard(page, name);
  await page.getByRole('button', { name: 'Tagasi avalehele', exact: true }).click();
  // Seed only this isolated browser's synthetic project: custom-pin editing belongs to M1.4.
  await page.evaluate(async (name) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bb-projects', 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        let seeded = false;
        const transaction = db.transaction('projects', 'readwrite');
        const cursor = transaction.objectStore('projects').openCursor();
        cursor.onsuccess = () => {
          const entry = cursor.result;
          if (!entry) return;
          const project = entry.value as { doc: BoardDoc };
          if (project.doc.name !== name) {
            entry.continue();
            return;
          }
          project.doc.scale.pxPerMm = 10;
          project.doc.components = [
            {
              id: 'cmp_adjacent',
              ref: 'X1',
              kind: 'other',
              marking: '',
              value: '',
              identified: true,
              dnp: false,
              note: '',
              pins: ['1', '2'].map((id) => ({ id, uid: `pin_adjacent_${id}`, nc: false })),
              board: {
                footprint: 'area',
                params: { w: 2, h: 2 },
                center: { x: 150, y: 150 },
                rotationDeg: 0,
                side: 'top',
                scaleX: 1,
                scaleY: 1,
                labelOffset: { x: -80, y: -80 },
                customPads: {
                  '1': { local: { x: 2, y: 0 }, sizeMm: 1, shape: 'circle', through: false },
                  '2': { local: { x: 7.4, y: 0 }, sizeMm: 1, shape: 'circle', through: false },
                },
              },
            },
          ];
          project.doc.measurements = ['1', '2'].map((id) => ({
            id: `msr_adjacent_${id}`,
            mode: 'voltage',
            at: { c: 'cmp_adjacent', p: id, uid: `pin_adjacent_${id}` },
            atLabel: `X1.${id}`,
            value: 3.651,
            power: 'on',
            takenAt: '2026-11-15T12:00:00Z',
            source: 'manual',
          }));
          entry.update(project);
          seeded = true;
        };
        transaction.oncomplete = () =>
          seeded ? resolve() : reject(new Error('Synthetic project missing'));
        transaction.onerror = transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      db.close();
    }
  }, name);
  await page.getByRole('button', { name: `Ava ${name}`, exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByText('100 %', { exact: true })).toBeVisible();
  const readings = page.locator('[data-layer="measurements.readings"] text');
  await expect(readings).toHaveCount(2);
  await expect(readings.nth(0)).toHaveText('3,651 V');
  await expect(readings.nth(1)).toHaveText('3,651 V');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const firstPin = await center(page.locator('[data-layer="components.pins"] [data-pin="1"]'));
  const secondPin = await center(page.locator('[data-layer="components.pins"] [data-pin="2"]'));
  expect(secondPin.x - firstPin.x).toBeCloseTo(54, 4);
  expect(secondPin.y).toBeCloseTo(firstPin.y, 4);
  const a = await textBounds(readings.nth(0));
  const b = await textBounds(readings.nth(1));
  expect(
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)),
  ).toBe(0);
});
