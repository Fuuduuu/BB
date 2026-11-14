import { expect, test } from '@playwright/test';

test('first_component_within_three_actions_after_photo', async ({ page }) => {
  await page.goto('/');
  const transfer = await page.evaluateHandle(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#185c43';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!)));
    const data = new DataTransfer();
    data.items.add(new File([blob], 'toiteplokk.png', { type: 'image/png' }));
    return data;
  });
  await page
    .getByText('Lohista plaadi foto siia või kleebi Ctrl+V', { exact: true })
    .dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
  await expect(page.getByRole('heading', { name: 'toiteplokk', exact: true })).toBeVisible();
  await expect(page.locator('image[data-layer="photo.image"]')).toBeVisible();
  const library = page.getByRole('tabpanel', { name: 'Teek', exact: true });
  await expect(library).toBeVisible();

  await page.evaluate(() => {
    const state = window as unknown as { photoPlacementActions: number };
    state.photoPlacementActions = 0;
    document.addEventListener('pointerdown', () => state.photoPlacementActions++, {
      capture: true,
    });
  });
  await library.getByRole('button', { name: 'Takisti SMD', exact: true }).click();
  await library.getByRole('button', { name: 'Paiguta', exact: true }).click();
  const surface = page.getByRole('main', { name: 'Plaat', exact: true }).getByLabel('Plaat', {
    exact: true,
  });
  const bounds = await surface.boundingBox();
  if (!bounds) throw new Error('Canvas is not visible');
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(page.locator('[data-layer="components.bodies"] [data-component]')).toHaveCount(1);
  await expect(page.locator('[data-layer="components.pins"] [data-pin]')).toHaveCount(2);
  const actions = await page.evaluate(
    () => (window as unknown as { photoPlacementActions: number }).photoPlacementActions,
  );
  expect(actions).toBeLessThanOrEqual(3);
});
