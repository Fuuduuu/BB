import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';
import { bounds, canvasViewport, center, createBoard } from './photo-flow-helpers';

test.use({ viewport: { width: 1280, height: 800 } });

async function fits(target: Locator) {
  const dimensions = await target.evaluate((element) => ({
    scroll: element.scrollWidth,
    client: element.clientWidth,
  }));
  expect(dimensions.client).toBeGreaterThan(0);
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
}

test('measure_panel_fits_280px_and_history_fits_240px', async ({ page }) => {
  await createBoard(page, 'Mõõtmise loetavuse kontroll');
  await page.getByRole('tab', { name: 'Teek', exact: true }).click();
  const library = page.getByRole('tabpanel', { name: 'Teek', exact: true });
  await library.getByRole('button', { name: 'SOIC', exact: true }).click();
  await library.getByRole('combobox', { name: 'Jalgu', exact: true }).selectOption('8');
  await library.getByRole('button', { name: 'Paiguta', exact: true }).click();
  const area = await bounds(canvasViewport(page));
  await page.mouse.click(area.x + 200, area.y + 300);
  await expect(page.locator('[data-layer="components.pins"] [data-pin]')).toHaveCount(8);
  await page.keyboard.press('Escape');
  const pin = async (id: string) =>
    center(page.locator(`[data-layer="components.pins"] [data-pin="${id}"]`));
  const red = await pin('4');
  await page.mouse.click(red.x, red.y);
  const measure = page.getByRole('region', { name: 'Mõõda', exact: true });
  const input = measure.getByRole('textbox', { name: 'Pinge', exact: true });
  await expect(input).toHaveCSS('font-size', '20px');
  await expect(input).toHaveCSS('font-variant-numeric', 'tabular-nums');
  await expect(input).toHaveCSS('font-family', /Martian Mono/);
  await expect(measure.getByText('nt 4,98', { exact: true })).toBeVisible();
  await input.press('Enter');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(measure.getByText('Sisesta pinge, nt 4,98.', { exact: true })).toBeVisible();
  await input.fill('vigane');
  await input.press('Enter');
  await expect(
    measure.getByText('Ei saa aru. Sisesta pinge voltides, nt 4,98 või 3m3.', { exact: true }),
  ).toBeVisible();
  await measure.getByRole('button', { name: 'Vali musta sondi jalg', exact: true }).click();
  const black = await pin('3');
  await page.mouse.click(black.x, black.y);
  for (const value of ['3,3', '4,98', '5', '12,345', '4,73']) {
    await input.fill(value);
    await input.press('Enter');
    await expect(input).toHaveValue('');
  }
  await input.press('Alt+ArrowDown');
  await input.fill('4,68');
  const lastSaved = measure.locator('.pcbk-last-saved');
  await expect(measure.locator('.pcbk-last-saved-live')).toHaveAttribute('aria-live', 'polite');
  await expect(lastSaved).toContainText('4,73 V');
  await expect(lastSaved).toContainText('U1.4 → U1.3');
  await expect(measure.getByRole('group', { name: 'Punane sond', exact: true })).toContainText(
    'U1.5',
  );
  const context = page.getByRole('complementary', { name: 'Omadused', exact: true });
  const contextHandle = page.getByRole('separator', {
    name: 'Omaduste paneeli laius',
    exact: true,
  });
  await contextHandle.press('Home');
  await expect(contextHandle).toHaveAttribute('aria-valuenow', '280');
  const historyTab = page.getByRole('tab', { name: 'Mõõtmised', exact: true });
  await historyTab.click();
  const history = page.getByRole('tabpanel', { name: 'Mõõtmised', exact: true });
  const rows = history.getByRole('listitem');
  await expect(rows).toHaveCount(5);
  const navHandle = page.getByRole('separator', { name: 'Navigaatori laius', exact: true });
  const navigator = page.getByRole('complementary', { name: 'Navigaator', exact: true });
  for (const viewport of [
    { width: 1100, height: 700 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      for (const width of [240, 300]) {
        await navHandle.press('Home');
        for (let step = 240; step < width; step += 10) await navHandle.press('ArrowRight');
        await expect(navHandle).toHaveAttribute('aria-valuenow', String(width));
        expect((await bounds(context)).width).toBe(280);
        expect((await bounds(navigator)).width).toBe(width);
        for (const target of [context, measure, measure.locator('form'), lastSaved, history])
          await fits(target);
        for (const row of await rows.all()) {
          await fits(row);
          await fits(row.locator('.pcbk-measurement-row__details'));
          const metadata = row.locator('.pcbk-measurement-row__metadata');
          await fits(metadata);
          const power = await bounds(metadata.locator('span'));
          const time = await bounds(metadata.locator('time'));
          expect(time.y).toBeCloseTo(power.y, 1);
          const remove = row.getByRole('button', { name: /^Kustuta mõõtmine / });
          await expect(remove).toHaveAttribute('title', 'Kustuta mõõtmine');
          expect((await bounds(remove)).width).toBe(28);
        }
      }
    }
  }
  await historyTab.focus();
  await page.keyboard.press('Tab');
  const firstDelete = rows.first().getByRole('button', { name: /^Kustuta mõõtmine / });
  await expect(firstDelete).toBeFocused();
  await expect(firstDelete).toHaveCSS('outline-style', 'solid');
  await expect(firstDelete).toHaveCSS('outline-width', '2px');

  // A long but supported voltage must keep its complete value inside both narrow panes.
  const longValue = `1${'0'.repeat(29)}`;
  await input.fill(longValue);
  await input.press('Enter');
  await expect(rows).toHaveCount(6);
  await expect(lastSaved.locator('.pcbk-last-saved__value')).toHaveText(`${longValue} V`);
  await expect(rows.first().locator('.pcbk-measurement-row__value')).toHaveText(`${longValue} V`);
  await page.setViewportSize({ width: 1100, height: 700 });
  for (const width of [240, 300]) {
    await navHandle.press('Home');
    for (let step = 240; step < width; step += 10) await navHandle.press('ArrowRight');
    for (const target of [
      context,
      measure,
      measure.locator('form'),
      lastSaved,
      history,
      rows.first(),
      rows.first().locator('.pcbk-measurement-row__details'),
    ])
      await fits(target);
  }
});
