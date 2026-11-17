import { expect, test } from '@playwright/test';
import { bounds, canvasViewport, createBoard } from './photo-flow-helpers';

test('stamp_three_resistors_then_escape', async ({ page }) => {
  await createBoard(page, 'Kolm takistit templiga');
  await page.getByRole('tab', { name: 'Teek', exact: true }).click();
  const library = page.getByRole('tabpanel', { name: 'Teek', exact: true });
  await library.getByRole('button', { name: 'Takisti SMD', exact: true }).click();
  await library.getByRole('button', { name: 'Paiguta', exact: true }).click();
  const area = await bounds(canvasViewport(page));
  for (const x of [100, 200, 300]) await page.mouse.click(area.x + x, area.y + 150);

  const bodies = page.locator('[data-layer="components.bodies"] [data-component]');
  await expect(bodies).toHaveCount(3);
  await page.keyboard.press('Escape');
  await page.mouse.click(area.x + 400, area.y + 150);
  await expect(bodies).toHaveCount(3);

  await page.getByRole('tab', { name: 'Komponendid', exact: true }).click();
  for (const ref of ['R1', 'R2', 'R3']) {
    await expect(page.getByRole('button', { name: `Vali ${ref}`, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Vali R4', exact: true })).toHaveCount(0);
});
