import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { BoardDoc, Component } from '@pcbk/domain';
import { createBoard } from './photo-flow-helpers';

const name = 'Sünteetiline Q1 kontaktide määramine';
const q1: Component = {
  id: 'cmp_q1',
  ref: 'Q1',
  kind: 'npn',
  marking: '',
  value: '',
  identified: true,
  dnp: false,
  note: '',
  pins: ['1', '2', '3'].map((id) => ({ id, uid: `pin_cmp_q1_${id}`, nc: false })),
  board: {
    footprint: 'area',
    params: { w: 10, h: 6 },
    center: { x: 240, y: 180 },
    side: 'top',
    rotationDeg: 0,
    scaleX: 1,
    scaleY: 1,
    customPads: {},
  },
  schematic: {
    symbol: 'box',
    at: { x: 83 * 2.54, y: 57 * 2.54 },
    rot: 0,
    mirror: false,
  },
};

async function seedBoard(page: Page) {
  await page.evaluate(
    async ({ name, component }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('bb-projects', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction('projects', 'readwrite');
          const cursor = transaction.objectStore('projects').openCursor();
          let updated = false;
          cursor.onsuccess = () => {
            const entry = cursor.result;
            if (!entry) return;
            const project = entry.value as { doc: BoardDoc };
            if (project.doc.name !== name) {
              entry.continue();
              return;
            }
            project.doc.components = [component];
            entry.update(project);
            updated = true;
          };
          transaction.oncomplete = () =>
            updated ? resolve() : reject(new Error('Synthetic Q1 project missing'));
          transaction.onerror = transaction.onabort = () => reject(transaction.error);
        });
      } finally {
        db.close();
      }
    },
    { name, component: q1 },
  );
}

async function schematicScreenPoint(page: Page) {
  return page.locator('svg [data-scene]').evaluate((scene, point) => {
    const matrix = (scene as SVGGraphicsElement).getScreenCTM();
    if (!matrix) throw new Error('Missing schematic screen transform');
    const { x, y } = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x, y };
  }, q1.schematic!.at);
}

test.use({ viewport: { width: 1600, height: 1000 } });

test('schematic_pin_function_and_show_on_board', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Välimus', exact: true }).selectOption('light');
  await createBoard(page, name);
  const saved = page.getByRole('status').filter({ hasText: 'Salvestatud' });
  await expect(saved).toBeVisible();
  await page.getByRole('button', { name: 'Tagasi avalehele', exact: true }).click();
  await seedBoard(page);
  await page.getByRole('button', { name: `Ava ${name}`, exact: true }).click();

  const zoom = page.locator('.pcbk-view-controls').getByText(/^\d+ %$/);
  const zoomIn = page.getByRole('button', { name: 'Suurenda', exact: true });
  const readZoom = async () => Number.parseInt(await zoom.innerText(), 10);
  const initial = await readZoom();
  await zoomIn.click();
  await expect.poll(readZoom).toBeGreaterThan(initial);
  const boardZoom = await readZoom();

  const views = page.getByRole('group', { name: 'Vaade', exact: true });
  await views.getByRole('button', { name: 'Skeem', exact: true }).click();
  const symbol = page.locator('svg [data-symbol][data-component="cmp_q1"]');
  await expect(symbol).toHaveAttribute('data-symbol', 'box');
  for (let step = 0; step < 8 && (await readZoom()) < 150; step++) {
    const previous = await readZoom();
    await zoomIn.click();
    await expect.poll(readZoom).toBeGreaterThan(previous);
  }
  expect(await readZoom()).toBeGreaterThanOrEqual(150);

  const { x, y } = await schematicScreenPoint(page);
  await page.mouse.click(x, y);
  const context = page.getByRole('complementary', { name: 'Omadused', exact: true });
  const sectionTitle = context.getByRole('heading', { name: 'Jalgade funktsioon', exact: true });
  await expect(sectionTitle).toBeVisible();
  await expect(
    context.getByText('Jalgade nimed ei anna funktsiooni üheselt. Skeemil on komponent kastina.'),
  ).toBeVisible();

  for (const [contact, pin] of [
    ['B', '2'],
    ['C', '1'],
    ['E', '3'],
  ] as const) {
    await context
      .getByRole('combobox', { name: `Kontakt ${contact}`, exact: true })
      .selectOption(pin);
  }
  await context.getByRole('button', { name: 'Salvesta', exact: true }).click();
  await expect(symbol).toHaveAttribute('data-symbol', 'npn');
  await page.keyboard.press('Control+z');
  await expect(symbol).toHaveAttribute('data-symbol', 'box');
  await page.keyboard.press('Control+y');
  await expect(symbol).toHaveAttribute('data-symbol', 'npn');

  await expect(sectionTitle).toBeVisible();
  await expect(context.getByRole('combobox', { name: 'Kontakt B', exact: true })).toHaveValue('2');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(saved).toBeVisible();
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: testInfo.outputPath('pin-function-light.png'),
    animations: 'disabled',
  });

  const point = await schematicScreenPoint(page);
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Näita plaadil', exact: true }).click();
  await expect(views.getByRole('button', { name: 'Plaat', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(context.getByRole('heading', { name: 'Q1', exact: true })).toBeVisible();
  await expect.poll(readZoom).toBe(boardZoom);
});
