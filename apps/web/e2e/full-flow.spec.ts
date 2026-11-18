import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { bounds, canvas, center, dropPhoto, photo, reopen } from './photo-flow-helpers';

type Point = { x: number; y: number };

const name = 'M1.4 sünteetiline plaat';
const photoWidth = 800;
const photoHeight = 600;
const boardWidth = 760;
const widthMm = 76;
const alignment = [
  { x: 260, y: 215 },
  { x: 324, y: 235 },
] as const;
const ownPad = { x: 351, y: 281 };
const placements = {
  u1: { x: 205, y: 145 },
  c1: { x: 140, y: 220 },
  c2: { x: 140, y: 330 },
  u2: { x: 245, y: 390 },
  j1: { x: 447, y: 160 },
  j2: { x: 458, y: 385 },
} as const;

const library = (page: Page) => page.getByRole('tabpanel', { name: 'Teek', exact: true });
const properties = (page: Page) =>
  page.getByRole('complementary', { name: 'Omadused', exact: true });
const field = (page: Page, name: string) =>
  properties(page).getByRole('textbox', { name, exact: true });
const bodies = (page: Page) => page.locator('[data-layer="components.bodies"] [data-component]');
const body = (page: Page, id: string) => bodies(page).and(page.locator(`[data-component="${id}"]`));
const pins = (page: Page, id: string) =>
  page.locator(`[data-layer="components.pins"] [data-component="${id}"] [data-pin]`);
const pin = (page: Page, id: string, number: string) =>
  pins(page, id).and(page.locator(`[data-pin="${number}"]`));
const scaleChip = (page: Page) =>
  page.getByRole('button', { name: 'Kalibreeri mõõtkava (K)', exact: true });

async function boardPhoto(page: Page) {
  const bytes = await page.evaluate(
    ({ photoWidth, photoHeight, boardWidth, alignment, ownPad, placements }) => {
      const image = document.createElement('canvas');
      image.width = photoWidth;
      image.height = photoHeight;
      const ctx = image.getContext('2d')!;
      ctx.fillStyle = '#27353a';
      ctx.fillRect(0, 0, photoWidth, photoHeight);
      ctx.fillStyle = '#255e4a';
      ctx.fillRect(20, 50, boardWidth, 500);
      ctx.fillStyle = '#dba963';
      for (const { x, y } of [...alignment, ownPad, ...Object.values(placements)]) {
        ctx.fillRect(x - 4, y - 4, 8, 8);
      }
      return image.toDataURL('image/png').split(',')[1]!;
    },
    { photoWidth, photoHeight, boardWidth, alignment, ownPad, placements },
  );
  return { name: `${name}.png`, mimeType: 'image/png', buffer: Buffer.from(bytes, 'base64') };
}

async function clickPhoto(page: Page, point: Point) {
  const box = await bounds(photo(page));
  await page.mouse.click(
    box.x + (point.x * box.width) / photoWidth,
    box.y + (point.y * box.height) / photoHeight,
  );
}

async function photoPoint(page: Page, marker: Locator): Promise<Point> {
  const box = await bounds(photo(page));
  const at = await center(marker);
  return {
    x: ((at.x - box.x) * photoWidth) / box.width,
    y: ((at.y - box.y) * photoHeight) / box.height,
  };
}

async function expectPhotoPoint(page: Page, marker: Locator, expected: Point) {
  await expect
    .poll(async () => {
      const at = await photoPoint(page, marker);
      return Math.hypot(at.x - expected.x, at.y - expected.y);
    })
    .toBeLessThan(1.5);
}

async function clickMarker(page: Page, marker: Locator) {
  const at = await center(marker);
  await page.mouse.click(at.x, at.y);
}

async function selectComponent(page: Page, id: string, ref: string) {
  await clickMarker(page, body(page, id).locator('polygon').first());
  await expect(field(page, 'Tähis')).toHaveValue(ref);
}

async function setField(page: Page, name: string, value: string) {
  const input = field(page, name);
  await input.fill(value);
  await input.press('Enter');
  await expect(input).toHaveValue(value);
}

async function placeFromLibrary(
  page: Page,
  entry: string,
  targets: readonly Point[],
  configure?: (panel: Locator) => Promise<unknown>,
) {
  const panel = library(page);
  await page.getByRole('tab', { name: 'Teek', exact: true }).click();
  await panel.getByRole('button', { name: entry, exact: true }).click();
  await configure?.(panel);
  const count = await bodies(page).count();
  await panel.getByRole('button', { name: 'Paiguta', exact: true }).click();
  for (const target of targets) await clickPhoto(page, target);
  await expect(bodies(page)).toHaveCount(count + targets.length);
  const ids = await bodies(page).evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-component')!),
  );
  await page.keyboard.press('Escape');
  return ids.slice(count);
}

async function pinAngle(page: Page, id: string) {
  const a = await photoPoint(page, pin(page, id, '1'));
  const b = await photoPoint(page, pin(page, id, '8'));
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function decimal(text: string) {
  return Number.parseFloat(text.replace(',', '.'));
}

test('full_flow_steps_1_to_5', async ({ page }) => {
  await test.step('Foto lohistamine avalehele avab töölaua', async () => {
    await page.goto('/');
    await dropPhoto(
      page,
      page.getByText('Lohista plaadi foto siia või kleebi Ctrl+V', { exact: true }),
      await boardPhoto(page),
    );
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(photo(page)).toBeVisible();
  });

  const calibratedScale =
    await test.step('760 piksli laiuse plaadi kalibreerimine 76 mm järgi', async () => {
      await canvas(page).focus();
      await page.keyboard.press('k');
      await clickPhoto(page, { x: 20, y: 100 });
      await clickPhoto(page, { x: 780, y: 100 });
      const millimetres = page.getByRole('textbox', { name: 'Vahe millimeetrites', exact: true });
      await millimetres.fill(String(widthMm));
      await millimetres.press('Enter');
      await expect(scaleChip(page)).toHaveText(/px\/mm$/);
      const text = await scaleChip(page).innerText();
      const expected = boardWidth / widthMm;
      expect(Math.abs(decimal(text) - expected) / expected).toBeLessThanOrEqual(0.005);
      return text;
    });

  const [u1] = await placeFromLibrary(page, 'SOIC', [placements.u1], (panel) =>
    panel.getByLabel('Jalgu', { exact: true }).selectOption('8'),
  );
  const chip = u1!;
  await expect(pins(page, chip)).toHaveCount(8);
  await test.step('SOIC-8 kahe jalaga joondus, käepide ning R ja Shift+R', async () => {
    await canvas(page).focus();
    await page.keyboard.press('a');
    await expect(page.getByText(/Joonda: vali jalg 1/)).toBeVisible();
    await clickMarker(page, pin(page, chip, '1'));
    await clickPhoto(page, alignment[0]);
    await clickMarker(page, pin(page, chip, '8'));
    await clickPhoto(page, alignment[1]);
    await expectPhotoPoint(page, pin(page, chip, '1'), alignment[0]);
    await expectPhotoPoint(page, pin(page, chip, '8'), alignment[1]);
    await page.keyboard.press('Escape');
    await selectComponent(page, chip, 'U1');
    const xScale = field(page, 'Mõõtkava X');
    const yScale = field(page, 'Mõõtkava Y');
    const alignedX = decimal(await xScale.inputValue());
    const alignedY = await yScale.inputValue();
    const handle = await center(page.locator('[data-scale-handle="e"]'));
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(handle.x + 14, handle.y, { steps: 4 });
    await page.mouse.up();
    await expect
      .poll(async () => decimal(await xScale.inputValue()))
      .toBeGreaterThan(alignedX + 0.05);
    await expect(yScale).toHaveValue(alignedY);
    const angle = await pinAngle(page, chip);
    await page.keyboard.press('r');
    await expect.poll(async () => (await pinAngle(page, chip)) - angle).toBeCloseTo(90, 1);
    await page.keyboard.press('Shift+r');
    await expect.poll(() => pinAngle(page, chip)).toBeCloseTo(angle, 1);
  });

  const firstPinAt = await photoPoint(page, pin(page, chip, '1'));
  const eighthPinAt = await photoPoint(page, pin(page, chip, '8'));
  const scaledX = await field(page, 'Mõõtkava X').inputValue();
  const scaledY = await field(page, 'Mõõtkava Y').inputValue();

  await test.step('Ülejäänud korpused ja U1 andmed', async () => {
    const [c1, c2] = await placeFromLibrary(
      page,
      'Kondensaator SMD',
      [placements.c1, placements.c2],
      (panel) => panel.getByLabel('Korpus', { exact: true }).selectOption('0805'),
    );
    for (const [id, ref] of [
      [c1!, 'C1'],
      [c2!, 'C2'],
    ] as const) {
      await selectComponent(page, id, ref);
      await expect(field(page, 'Väärtus või mudel')).toHaveValue('');
      await expect(field(page, 'Korpuse märgistus')).toHaveValue('');
      await expect(properties(page)).toContainText('Suurus 0805');
    }
    const [u2] = await placeFromLibrary(page, 'SOT-23', [placements.u2], (panel) =>
      panel.getByLabel('Jalgu', { exact: true }).selectOption('3'),
    );
    await selectComponent(page, u2!, 'Q1');
    await properties(page).getByLabel('Tüüp', { exact: true }).selectOption('regulator');
    await setField(page, 'Tähis', 'U2');
    await expect(pins(page, u2!)).toHaveCount(3);
    const [j1] = await placeFromLibrary(page, 'USB-C', [placements.j1]);
    await selectComponent(page, j1!, 'J1');
    await expect(pins(page, j1!)).toHaveCount(16);
    const [j2] = await placeFromLibrary(page, 'Pinnirida 1×N', [placements.j2], (panel) =>
      panel.getByLabel('Jalgu', { exact: true }).fill('4'),
    );
    await selectComponent(page, j2!, 'J2');
    await expect(pins(page, j2!)).toHaveCount(4);

    await selectComponent(page, chip, 'U1');
    await setField(page, 'Korpuse märgistus', 'ATTINY85');
    await setField(page, 'Väärtus või mudel', 'ATtiny85');
    await setField(page, 'Jala 8 nimi', 'VCC');
  });

  await test.step('U1 oma jalg ja projekti taasavamine', async () => {
    await canvas(page).focus();
    await page.keyboard.press('j');
    await expect(page.getByText(/Lisa jalg: klõpsa plaadil/)).toBeVisible();
    await clickPhoto(page, ownPad);
    await expect(pins(page, chip)).toHaveCount(9);
    await expectPhotoPoint(page, pin(page, chip, '9'), ownPad);
    await page.keyboard.press('Escape');

    await reopen(page, name);
    await expect(photo(page)).toBeVisible();
    await expect(scaleChip(page)).toHaveText(calibratedScale);
    await expect(bodies(page)).toHaveCount(6);
    const labels = page.locator('[data-layer="components.labels"] text');
    for (const ref of ['U1', 'C1', 'C2', 'U2', 'J1', 'J2']) {
      await expect(labels.filter({ hasText: new RegExp(`^${ref}(?: \\?)?$`) })).toBeVisible();
    }
    await expectPhotoPoint(page, pin(page, chip, '1'), firstPinAt);
    await expectPhotoPoint(page, pin(page, chip, '8'), eighthPinAt);
    await expectPhotoPoint(page, pin(page, chip, '9'), ownPad);
    await expect(pins(page, chip)).toHaveCount(9);
    await selectComponent(page, chip, 'U1');
    await expect(field(page, 'Korpuse märgistus')).toHaveValue('ATTINY85');
    await expect(field(page, 'Väärtus või mudel')).toHaveValue('ATtiny85');
    await expect(field(page, 'Jala 8 nimi')).toHaveValue('VCC');
    await expect(field(page, 'Mõõtkava X')).toHaveValue(scaledX);
    await expect(field(page, 'Mõõtkava Y')).toHaveValue(scaledY);
  });
});
