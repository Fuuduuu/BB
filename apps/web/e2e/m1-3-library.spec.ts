import { expect, test } from '@playwright/test';
import { bounds, canvas, center, createBoard } from './photo-flow-helpers';

test('library_places_qfp44_and_testpoint', async ({ page }) => {
  await createBoard(page, 'QFP ja testpunkt teegist');
  await page.getByRole('tab', { name: 'Teek', exact: true }).click();
  const library = page.getByRole('tabpanel', { name: 'Teek', exact: true });
  const search = library.getByRole('searchbox', { name: 'Otsi korpust', exact: true });
  await search.fill('QFP');
  await library.getByRole('button', { name: 'QFP', exact: true }).click();
  await library.getByRole('button', { name: 'Paiguta', exact: true }).click();
  const qfpAt = await center(canvas(page));
  await page.mouse.click(qfpAt.x, qfpAt.y);
  const pinGroups = page.locator('[data-layer="components.pins"] [data-component]');
  await expect(pinGroups).toHaveCount(1);
  const qfpId = await pinGroups.getAttribute('data-component');
  const qfp = pinGroups.filter({ has: page.locator('[data-pin="44"]') });
  await expect(qfp.locator('[data-pin]')).toHaveCount(44);
  await page.keyboard.press('Escape');

  await search.fill('testpunkt');
  await library.getByRole('button', { name: 'Testpunkt', exact: true }).click();
  await library.getByRole('button', { name: 'Paiguta', exact: true }).click();
  const area = await bounds(canvas(page));
  await page.mouse.click(area.x + 150, area.y + 150);
  await expect(pinGroups).toHaveCount(2);
  const testpoint = page.locator(
    `[data-layer="components.pins"] [data-component]:not([data-component="${qfpId}"])`,
  );
  await expect(testpoint.locator('[data-pin]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  const testpointAt = await center(testpoint.locator('[data-pin="1"]'));
  await page.mouse.click(testpointAt.x, testpointAt.y);
  await expect(
    page.getByRole('region', { name: 'Mõõda', exact: true }).getByText('TP1.1', { exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Komponendid', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Vali TP1', exact: true })).toBeVisible();
});
