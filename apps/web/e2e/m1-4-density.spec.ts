import { expect, test } from '@playwright/test';
import { bounds, createBoard } from './photo-flow-helpers';

test('library_rows_show_silhouettes_at_240px', async ({ page }) => {
  await createBoard(page, 'Teegi siluetid');
  await page.getByRole('tab', { name: 'Teek', exact: true }).click();
  const navigator = page.getByRole('complementary', { name: 'Navigaator', exact: true });
  const handle = page.getByRole('separator', { name: 'Navigaatori laius', exact: true });
  await handle.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '240');
  expect((await bounds(navigator)).width).toBe(240);

  const library = navigator.getByRole('tabpanel', { name: 'Teek', exact: true });
  const rows = library.locator('button[aria-expanded]');
  await expect(rows).toHaveCount(41);
  await expect(library.locator('svg[data-silhouette]')).toHaveCount(41);
  const metrics = await rows.evaluateAll((buttons) =>
    buttons.map((button) => {
      const body = button.querySelector('.pcbk-component-row__body')!;
      const name = body.firstElementChild!;
      const silhouette = button.querySelector('svg[data-silhouette]')!;
      const rowBox = button.getBoundingClientRect();
      const shape = silhouette.getBoundingClientRect();
      const nameRange = document.createRange();
      nameRange.selectNodeContents(name);
      const nameBox = nameRange.getBoundingClientRect();
      const style = getComputedStyle(button);
      const rowWithoutSilhouette =
        body.getBoundingClientRect().height +
        parseFloat(style.paddingTop) +
        parseFloat(style.paddingBottom) +
        parseFloat(style.borderTopWidth) +
        parseFloat(style.borderBottomWidth);
      return {
        name: name.textContent,
        width: shape.width,
        height: shape.height,
        hidden: silhouette.getAttribute('aria-hidden'),
        shapeFits:
          shape.left >= rowBox.left &&
          shape.right <= rowBox.right &&
          shape.top >= rowBox.top &&
          shape.bottom <= rowBox.bottom,
        nameFits: nameRange.getClientRects().length === 1 && nameBox.right <= rowBox.right,
        heightUnchanged: Math.abs(rowBox.height - rowWithoutSilhouette) < 0.1,
      };
    }),
  );
  for (const metric of metrics) {
    expect(metric, metric.name ?? '').toMatchObject({
      width: 28,
      height: 18,
      hidden: 'true',
      shapeFits: true,
      nameFits: true,
      heightUnchanged: true,
    });
  }

  const row = (name: string) => library.getByRole('button', { name, exact: true });
  for (const [name, pads] of [
    ['SOIC', 8],
    ['QFP', 44],
    ['Pinnirida 1×N', 4],
    ['Testpunkt', 1],
    ['Tundmatu komponent', 0],
  ] as const) {
    await expect(row(name).locator('svg[data-silhouette] [data-pad]')).toHaveCount(pads);
  }

  await library.getByRole('searchbox', { name: 'Otsi korpust', exact: true }).focus();
  await page.keyboard.press('Tab');
  const first = rows.first();
  await expect(first).toBeFocused();
  await expect(first).toHaveCSS('outline-style', 'solid');
  expect(
    parseFloat(await first.evaluate((button) => getComputedStyle(button).outlineWidth)),
  ).toBeGreaterThan(0);

  await row('SOIC').click();
  await library.getByRole('combobox', { name: 'Jalgu', exact: true }).selectOption('14');
  const preview = library.getByRole('img', { name: 'Pealtvaade: SOIC, 14 jalga', exact: true });
  const previewBox = await bounds(preview);
  expect({ width: previewBox.width, height: previewBox.height }).toEqual({
    width: 120,
    height: 72,
  });
  await expect(preview.locator('[data-pad]')).toHaveCount(14);
});
