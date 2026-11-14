import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { withExifOrientation } from '../../desktop/src/perf/png-exif';

export const canvas = (page: Page) =>
  page.getByRole('main', { name: 'Plaat', exact: true }).getByLabel('Plaat', { exact: true });
export const photo = (page: Page) => page.locator('image[data-layer="photo.image"]');
export const undo = (page: Page) => page.getByRole('button', { name: 'Võta tagasi', exact: true });

export async function bounds(target: Locator) {
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  if (!box) throw new Error('Visible element has no bounding box');
  return box;
}

export async function center(target: Locator) {
  const box = await bounds(target);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export async function createBoard(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Uus plaat', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nimi', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Alusta', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

export async function reopen(page: Page, name: string) {
  await expect(page.getByRole('status').filter({ hasText: 'Salvestatud' })).toBeVisible();
  await page.getByRole('button', { name: 'Tagasi avalehele', exact: true }).click();
  await page.getByRole('button', { name: `Ava ${name}`, exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

export async function syntheticPhoto(page: Page, portrait = false) {
  const bytes = await page.evaluate(async (portrait) => {
    const image = document.createElement('canvas');
    image.width = portrait ? 400 : 800;
    image.height = portrait ? 300 : 600;
    const context = image.getContext('2d')!;
    context.fillStyle = '#185c43';
    context.fillRect(0, 0, image.width, image.height);
    // EXIF 6 maps raw red centre (72,242) to upright (58,72),
    // blue (302,62) to (238,302). PNG centres: (220,190), (650,450).
    context.fillStyle = '#fa1010';
    context.fillRect(
      portrait ? 60 : 198,
      portrait ? 230 : 168,
      portrait ? 24 : 44,
      portrait ? 24 : 44,
    );
    context.fillStyle = '#1010fa';
    context.fillRect(
      portrait ? 290 : 628,
      portrait ? 50 : 428,
      portrait ? 24 : 44,
      portrait ? 24 : 44,
    );
    const blob = await new Promise<Blob>((resolve) =>
      image.toBlob((value) => resolve(value!), portrait ? 'image/jpeg' : 'image/png', 0.98),
    );
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, portrait);
  const source = new Uint8Array(bytes).buffer;
  return {
    name: portrait ? 'portree.jpg' : 'orientiirid.png',
    mimeType: portrait ? 'image/jpeg' : 'image/png',
    buffer: Buffer.from(portrait ? withExifOrientation(source, 6) : source),
  };
}

export async function dropPhoto(
  page: Page,
  target: Locator,
  file: Awaited<ReturnType<typeof syntheticPhoto>>,
) {
  const transfer = await page.evaluateHandle(
    ({ name, mimeType, bytes }) => {
      const data = new DataTransfer();
      data.items.add(new File([new Uint8Array(bytes)], name, { type: mimeType }));
      return data;
    },
    { name: file.name, mimeType: file.mimeType, bytes: Array.from(file.buffer) },
  );
  await target.dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
}

// Measure only rendered screenshot pixels; never reuse the product's scene matrix.
// Extrema survive the pin obscuring the middle of the red rectangle.
export async function screenshotMarks(page: Page) {
  const clip = await bounds(photo(page));
  const screenshot = await page.screenshot();
  return page.evaluate(
    async ({ png, clip }) => {
      const bytes = Uint8Array.from(atob(png), (character) => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const image = document.createElement('canvas');
      image.width = bitmap.width;
      image.height = bitmap.height;
      const context = image.getContext('2d')!;
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const { data } = context.getImageData(0, 0, image.width, image.height);
      return ['red', 'blue'].map((color) => {
        let left = Infinity,
          right = -Infinity,
          top = Infinity,
          bottom = -Infinity,
          count = 0;
        for (
          let y = Math.max(0, Math.ceil(clip.y));
          y < Math.min(image.height, clip.y + clip.height);
          y++
        ) {
          for (
            let x = Math.max(0, Math.ceil(clip.x));
            x < Math.min(image.width, clip.x + clip.width);
            x++
          ) {
            const i = (y * image.width + x) * 4;
            const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
            if (color === 'red' ? r > 180 && g < 80 && b < 80 : b > 180 && r < 80 && g < 80) {
              left = Math.min(left, x);
              right = Math.max(right, x);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
              count++;
            }
          }
        }
        if (count < 20)
          throw new Error(`Screenshot has no ${color} photo marker (${count} pixels)`);
        return { x: (left + right + 1) / 2, y: (top + bottom + 1) / 2 };
      });
    },
    { png: screenshot.toString('base64'), clip },
  );
}
