import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { bounds, canvas, center, dropPhoto, photo } from './photo-flow-helpers';

type Point = { x: number; y: number };

const name = 'M2.2b sünteetiline mõõtkava';
const photoWidth = 800;
const photoHeight = 600;
const targetA = { x: 300, y: 300 };
const targetB = { x: 376.2, y: 300 };
const dipCenter = { x: 600, y: 330 };
const capacitorCenter = { x: 150, y: 470 };
const initialPin = { x: 486, y: 216 };
const wrongScale = '29,92 px/mm';

async function boardPhoto(page: Page) {
  const bytes = await page.evaluate(
    ({ photoWidth, photoHeight, targets }) => {
      const image = document.createElement('canvas');
      image.width = photoWidth;
      image.height = photoHeight;
      const ctx = image.getContext('2d')!;
      ctx.fillStyle = '#27353a';
      ctx.fillRect(0, 0, photoWidth, photoHeight);
      ctx.fillStyle = '#255e4a';
      ctx.fillRect(20, 50, 760, 500);
      ctx.fillStyle = '#dba963';
      for (const { x, y } of targets) ctx.fillRect(x - 4, y - 4, 8, 8);
      return image.toDataURL('image/png').split(',')[1]!;
    },
    { photoWidth, photoHeight, targets: [targetA, targetB] },
  );
  return { name: `${name}.png`, mimeType: 'image/png', buffer: Buffer.from(bytes, 'base64') };
}

async function clickPhoto(page: Page, { x, y }: Point) {
  const image = await bounds(photo(page));
  await page.mouse.click(
    image.x + (x * image.width) / photoWidth,
    image.y + (y * image.height) / photoHeight,
  );
}

async function photoGeometry(page: Page, target: Locator) {
  const image = await bounds(photo(page));
  const box = await bounds(target);
  return {
    x: ((box.x + box.width / 2 - image.x) * photoWidth) / image.width,
    y: ((box.y + box.height / 2 - image.y) * photoHeight) / image.height,
  };
}

function photoBodyGeometry(body: Locator) {
  return body.evaluate((element) => {
    const polygon = element as SVGPolygonElement;
    const image = polygon.ownerSVGElement?.querySelector<SVGImageElement>(
      'image[data-layer="photo.image"]',
    );
    const imageMatrix = image?.getScreenCTM();
    const bodyMatrix = polygon.getScreenCTM();
    if (!image || !imageMatrix || !bodyMatrix)
      throw new Error('Missing photo or outline transform');

    // Measure the whole drawn outline in photo pixels, even when some of it is offscreen.
    const toPhoto = imageMatrix.inverse().multiply(bodyMatrix);
    const points = Array.from({ length: polygon.points.numberOfItems }, (_, index) =>
      polygon.points.getItem(index).matrixTransform(toPhoto),
    );
    const xs = points.map(({ x }) => x - image.x.baseVal.value);
    const ys = points.map(({ y }) => y - image.y.baseVal.value);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    return {
      x: (left + right) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
      width: right - left,
    };
  });
}

async function expectPhotoPoint(page: Page, marker: Locator, expected: Point) {
  await expect
    .poll(async () => {
      const at = await photoGeometry(page, marker);
      return Math.hypot(at.x - expected.x, at.y - expected.y);
    })
    .toBeLessThanOrEqual(1.5);
}

async function expectPhotoWidth(body: Locator, expected: number) {
  await expect
    .poll(async () => {
      const { width } = await photoBodyGeometry(body);
      return Math.abs(width / expected - 1);
    })
    .toBeLessThanOrEqual(0.02);
}

async function clickMarker(page: Page, marker: Locator) {
  const at = await center(marker);
  await page.mouse.click(at.x, at.y);
}

async function placeFromLibrary(page: Page, entry: string, target: Point) {
  const panel = page.getByRole('tabpanel', { name: 'Teek', exact: true });
  await page.getByRole('tab', { name: 'Teek', exact: true }).click();
  await panel.getByRole('button', { name: entry, exact: true }).click();
  if (entry === 'DIP') {
    await panel.getByLabel('Jalgu', { exact: true }).selectOption('8');
    await panel.getByLabel('Ridade vahe', { exact: true }).selectOption('7.62');
  }
  const bodies = page.locator('[data-layer="components.bodies"] [data-component]');
  const count = await bodies.count();
  await panel.getByRole('button', { name: 'Paiguta', exact: true }).click();
  await clickPhoto(page, target);
  await expect(bodies).toHaveCount(count + 1);
  const id = await bodies.nth(count).getAttribute('data-component');
  expect(id).toBeTruthy();
  await page.keyboard.press('Escape');
  return id!;
}

test('scale_from_footprint_end_to_end', async ({ page }) => {
  await page.goto('/');
  await dropPhoto(
    page,
    page.getByText('Lohista plaadi foto siia või kleebi Ctrl+V', { exact: true }),
    await boardPhoto(page),
  );
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const scaleChip = page.getByRole('button', { name: 'Kalibreeri mõõtkava (K)', exact: true });

  await test.step('Vale mõõtkava kiirvaliku ja selle eelvaatega', async () => {
    await canvas(page).focus();
    await page.keyboard.press('k');
    await clickPhoto(page, { x: 20, y: 100 });
    await clickPhoto(page, { x: 780, y: 100 });
    const dialog = page.getByRole('dialog', { name: 'Kui pikk see lõik on?', exact: true });
    await dialog.getByRole('button', { name: '25,4 mm', exact: true }).click();
    await expect(dialog.getByText('= 29,92 px/mm · 1 px = 33 µm', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Foto: 27 × 20 mm', { exact: true })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(scaleChip).toHaveText(wrongScale);
  });

  const dip = await placeFromLibrary(page, 'DIP', dipCenter);
  const capacitor = await placeFromLibrary(page, 'Elektrolüüt THT', capacitorCenter);
  const body = page
    .locator(`[data-layer="components.bodies"] [data-component="${capacitor}"] polygon`)
    .first();
  const pin = (number: string) =>
    page.locator(`[data-layer="components.pins"] [data-component="${dip}"] [data-pin="${number}"]`);
  const pin1 = pin('1');
  const pin8 = pin('8');
  await expectPhotoPoint(page, pin1, initialPin);
  const initialCapacitor = await photoBodyGeometry(body);

  await test.step('Kahe jala joondus pakub foto mõõtkava parandamist', async () => {
    await canvas(page).focus();
    await page.keyboard.press('a');
    await expect(page.getByText(/Joonda: vali jalg 1/)).toBeVisible();
    await clickMarker(page, pin1);
    await clickPhoto(page, targetA);
    await clickMarker(page, pin8);
    await clickPhoto(page, targetB);
    const dialog = page.getByRole('dialog', {
      name: 'Kas kasutada seda korpust mõõtkava aluseks?',
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(scaleChip).toHaveText(wrongScale);
    await expectPhotoPoint(page, pin1, targetA);
    await expectPhotoPoint(page, pin8, targetB);
    await dialog.getByRole('button', { name: 'Kasuta mõõtkavaks', exact: true }).click();

    const properties = page.getByRole('complementary', { name: 'Omadused', exact: true });
    await expect(properties.getByRole('textbox', { name: 'Mõõtkava X', exact: true })).toHaveValue(
      '1',
    );
    await expect
      .poll(async () => {
        const scale = Number.parseFloat((await scaleChip.innerText()).replace(',', '.'));
        return Math.abs(scale / 10 - 1);
      })
      .toBeLessThanOrEqual(0.01);
    await expectPhotoPoint(page, pin1, targetA);
    await expectPhotoPoint(page, pin8, targetB);
    const scaledCapacitor = await photoBodyGeometry(body);
    expect(
      Math.hypot(scaledCapacitor.x - initialCapacitor.x, scaledCapacitor.y - initialCapacitor.y),
    ).toBeLessThanOrEqual(1.5);
    await expectPhotoWidth(body, initialCapacitor.width * (10 / 29.92));
  });

  await test.step('Kaks tagasivõtmist taastavad mõõtkava ja seejärel paigutuse', async () => {
    await canvas(page).focus();
    await page.keyboard.press('Control+z');
    await expect(scaleChip).toHaveText(wrongScale);
    await expectPhotoPoint(page, pin1, targetA);
    await expectPhotoPoint(page, pin8, targetB);
    await expectPhotoWidth(body, initialCapacitor.width);

    await page.keyboard.press('Control+z');
    await expectPhotoPoint(page, pin1, initialPin);
  });
});
