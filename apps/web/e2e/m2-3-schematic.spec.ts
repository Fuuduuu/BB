import { expect, test } from '@playwright/test';
import { canvas, createBoard, dropPhoto, photo, syntheticPhoto } from './photo-flow-helpers';

test('schematic_view_switch_keeps_each_view', async ({ page }) => {
  await createBoard(page, 'Sünteetiline skeemivaate proov');
  await dropPhoto(page, canvas(page), await syntheticPhoto(page));
  await expect(photo(page)).toBeVisible();

  const zoom = page.locator('.pcbk-view-controls').getByText(/^\d+ %$/);
  const zoomIn = page.getByRole('button', { name: 'Suurenda', exact: true });
  async function increaseZoom() {
    const previous = await zoom.innerText();
    await zoomIn.click();
    await expect(zoom).not.toHaveText(previous);
    return zoom.innerText();
  }

  await increaseZoom();
  const boardZoom = await increaseZoom();

  const views = page.getByRole('group', { name: 'Vaade', exact: true });
  const schematicButton = views.getByRole('button', { name: 'Skeem', exact: true });
  await page.keyboard.press('Control+Tab');
  await expect(schematicButton).toHaveAttribute('aria-pressed', 'true');
  const sheet = page.locator('svg [data-scene] rect[width="420"][height="297"]').first();
  await expect(sheet).toBeVisible();
  await expect(page.getByText('Skeemil pole veel komponente.', { exact: true })).toBeVisible();
  await expect(page.locator('image')).toHaveCount(0);
  const schematicZoom = await increaseZoom();

  await views.getByRole('button', { name: 'Plaat', exact: true }).click();
  await expect(zoom).toHaveText(boardZoom);
  await expect(photo(page)).toBeVisible();

  await page.keyboard.press('Control+Tab');
  await expect(schematicButton).toHaveAttribute('aria-pressed', 'true');
  await expect(zoom).toHaveText(schematicZoom);
});
