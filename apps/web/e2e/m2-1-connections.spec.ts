import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { bounds, canvas, canvasViewport, center, createBoard } from './photo-flow-helpers';

const pin = (page: Page, componentId: string, number: string) =>
  page.locator(
    `[data-layer="components.pins"] [data-component="${componentId}"] [data-pin="${number}"]`,
  );
const traceShapes = (page: Page) =>
  page.locator('[data-layer="connections.traces"] polyline:not([stroke="var(--danger)"])');
const airLines = (page: Page) =>
  page.locator('[data-layer="connections.airLines"] line:not([stroke="var(--danger)"])');
const junctions = (page: Page) => page.locator('[data-layer="connections.junctions"] circle');

type Point = { x: number; y: number };

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

async function click(page: Page, at: Point, button: 'left' | 'right' = 'left') {
  await page.mouse.click(at.x, at.y, { button });
}

async function undo(page: Page) {
  await canvas(page).focus();
  await page.keyboard.press('Control+z');
}

async function redo(page: Page) {
  await page.getByRole('button', { name: 'Tee uuesti', exact: true }).click();
}

test('connections_flow_end_to_end', async ({ page }) => {
  const name = 'Ühenduste katse';
  await createBoard(page, name);
  await page.getByRole('tab', { name: 'Teek', exact: true }).click();
  const library = page.getByRole('tabpanel', { name: 'Teek', exact: true });
  await library.getByRole('button', { name: 'SOIC', exact: true }).click();
  await library.getByRole('combobox', { name: 'Jalgu', exact: true }).selectOption('8');
  await library.getByRole('button', { name: 'Paiguta', exact: true }).click();
  const area = await bounds(canvasViewport(page));
  await page.mouse.click(area.x + 210, area.y + 300);
  await page.mouse.click(area.x + 590, area.y + 300);
  await page.keyboard.press('Escape');
  const bodies = page.locator('[data-layer="components.bodies"] [data-component]');
  await expect(bodies).toHaveCount(2);
  const componentIds = await bodies.evaluateAll((items) =>
    items.map((element) => element.getAttribute('data-component')!),
  );
  const [left, right] = componentIds;
  const start = await center(pin(page, left!, '1'));
  const end = await center(pin(page, right!, '1'));
  const branchStart = await center(pin(page, right!, '4'));
  const waypoint = { x: (start.x + end.x) / 2, y: start.y - 90 };
  const branchEnd = midpoint(waypoint, end);
  const branchMiddle = midpoint(branchStart, branchEnd);
  const traces = traceShapes(page);
  const lines = airLines(page);
  const dots = junctions(page);

  await test.step('draw a trace with a waypoint and undo', async () => {
    await canvas(page).focus();
    await page.keyboard.press('t');
    await click(page, start);
    await click(page, waypoint);
    await click(page, end);
    await expect(traces).toHaveCount(1);
    await expect(traces).toHaveAttribute('points', /^\S+ \S+ \S+$/);
    await undo(page);
    await expect(traces).toHaveCount(0);
    await redo(page);
    await expect(traces).toHaveCount(1);
  });

  await test.step('branch onto the trace and undo the branch', async () => {
    await click(page, branchStart);
    await click(page, branchEnd);
    await expect(traces).toHaveCount(3);
    await expect(dots).toHaveCount(1);
    await undo(page);
    await expect(traces).toHaveCount(1);
    await expect(dots).toHaveCount(0);
    await redo(page);
    await expect(traces).toHaveCount(3);
    await expect(dots).toHaveCount(1);
  });

  await test.step('quick-connect three pins and undo both air lines together', async () => {
    await canvas(page).focus();
    await page.keyboard.press('Escape');
    await click(page, await center(pin(page, left!, '6')));
    await page.keyboard.down('Shift');
    await click(page, await center(pin(page, left!, '8')));
    await click(page, await center(pin(page, right!, '6')));
    await page.keyboard.up('Shift');
    await page.keyboard.press('c');
    await expect(lines).toHaveCount(2);
    await undo(page);
    await expect(lines).toHaveCount(0);
    await redo(page);
    await expect(lines).toHaveCount(2);
  });

  await page.getByRole('tab', { name: 'Võrgud', exact: true }).click();
  const networks = page.getByRole('tabpanel', { name: 'Võrgud', exact: true });
  const ground = networks.getByRole('button', { name: / · 4 liiget(?: · GND)?$/ });
  const power = networks.getByRole('button', { name: / · 3 liiget(?: · 5V)?$/ });
  const back = networks.getByRole('button', { name: '← Võrgud', exact: true });

  await test.step('assign both roles and confirm each assignment is undoable', async () => {
    await ground.click();
    const gndRole = networks.getByRole('button', { name: 'GND', exact: true });
    await gndRole.click();
    await expect(gndRole).toHaveAttribute('aria-pressed', 'true');
    await undo(page);
    await expect(gndRole).toHaveAttribute('aria-pressed', 'false');
    await redo(page);
    await expect(gndRole).toHaveAttribute('aria-pressed', 'true');
    await back.click();

    await power.click();
    const powerRole = networks.getByRole('button', { name: '5V', exact: true });
    await powerRole.click();
    await expect(powerRole).toHaveAttribute('aria-pressed', 'true');
    await undo(page);
    await expect(powerRole).toHaveAttribute('aria-pressed', 'false');
    await redo(page);
    await expect(powerRole).toHaveAttribute('aria-pressed', 'true');
    await back.click();
  });

  await test.step('join the networks, show the role conflict and undo the join', async () => {
    await ground.click();
    await networks.getByRole('button', { name: 'Ühenda võrguga…', exact: true }).click();
    const join = page.getByRole('dialog', { name: 'Ühenda võrguga…', exact: true });
    await join.getByRole('button', { name: / · 3 liiget · 5V$/ }).click();
    const warning = networks
      .getByRole('alert')
      .filter({ hasText: 'Võimalik lühis või vale ühendus' });
    await expect(warning).toHaveText(/(?:5V \+ GND|GND \+ 5V)$/);
    await expect(lines).toHaveCount(3);
    await undo(page);
    await expect(warning).toHaveCount(0);
    await expect(lines).toHaveCount(2);
    await back.click();
    await expect(ground).toHaveAccessibleName(/ · GND$/);
    await expect(power).toHaveAccessibleName(/ · 5V$/);
  });

  await test.step('remove the drawing and connection separately and undo each', async () => {
    await click(page, branchMiddle, 'right');
    await page.getByRole('menuitem', { name: 'Eemalda joonistus', exact: true }).click();
    await expect(traces).toHaveCount(2);
    await expect(lines).toHaveCount(3);
    await undo(page);
    await expect(traces).toHaveCount(3);
    await expect(lines).toHaveCount(2);
    await redo(page);
    await expect(lines).toHaveCount(3);

    await click(page, branchMiddle, 'right');
    await page.getByRole('menuitem', { name: 'Kustuta ühendus', exact: true }).click();
    await expect(lines).toHaveCount(2);
    await undo(page);
    await expect(lines).toHaveCount(3);
    await expect(traces).toHaveCount(2);
  });

  await test.step('download the resulting netlist from the Nets tab', async () => {
    const exportButton = networks.getByRole('button', {
      name: 'Ekspordi võrguloend (CSV)',
      exact: true,
    });
    await expect(exportButton).toBeEnabled();
    const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
    expect(download.suggestedFilename()).toBe(`${name} võrguloend.csv`);
    expect(await download.failure()).toBeNull();
  });
});
