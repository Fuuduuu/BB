import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { BoardDoc, Component, Vec2 } from '@pcbk/domain';
import { canvas, createBoard, dropPhoto, photo, syntheticPhoto } from './photo-flow-helpers';

const name = 'Sünteetiline skeemi vastuvõtt';
const r2 = 'cmp_acceptance_r2';
const u1 = 'cmp_acceptance_u1';
const takenAt = '2026-01-01T00:00:00.000Z';

function component(
  id: string,
  ref: string,
  kind: Component['kind'],
  pinCount: number,
  center: Vec2,
  at: Vec2,
  footprint: Pick<NonNullable<Component['board']>, 'footprint' | 'params'>,
): Component {
  return {
    id,
    ref,
    kind,
    marking: '',
    value: '',
    identified: true,
    dnp: false,
    note: '',
    pins: Array.from({ length: pinCount }, (_, index) => ({
      id: String(index + 1),
      uid: `pin_${id}_${index + 1}`,
      nc: false,
    })),
    board: {
      ...footprint,
      center,
      rotationDeg: 0,
      side: 'top',
      scaleX: 1,
      scaleY: 1,
      customPads: {},
    },
    schematic: { symbol: kind === 'resistor' ? 'resistor' : 'box', at, rot: 0, mirror: false },
  };
}

const existing: Pick<BoardDoc, 'components' | 'connections' | 'measurements'> = {
  components: [
    component(
      r2,
      'R2',
      'resistor',
      2,
      { x: 270, y: 210 },
      { x: 71 * 2.54, y: 56 * 2.54 },
      {
        footprint: 'chip',
        params: { size: '0805' },
      },
    ),
    component(
      u1,
      'U1',
      'ic',
      4,
      { x: 515, y: 350 },
      { x: 94 * 2.54, y: 62 * 2.54 },
      {
        footprint: 'area',
        params: { w: 12, h: 8 },
      },
    ),
  ],
  connections: [
    {
      id: 'con_acceptance_r2_u1',
      a: { pin: { c: r2, p: '1' } },
      b: { pin: { c: u1, p: '3' } },
      basis: 'visual',
    },
  ],
  measurements: [
    {
      id: 'msr_acceptance_u1',
      mode: 'voltage',
      source: 'manual',
      power: 'on',
      at: { c: u1, p: '3', uid: `pin_${u1}_3` },
      atLabel: 'U1.3',
      value: 3.3,
      takenAt,
    },
  ],
};

async function storedBoard(page: Page, seed?: typeof existing): Promise<BoardDoc> {
  return page.evaluate(
    async ({ name, seed }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('bb-projects', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        return await new Promise<BoardDoc>((resolve, reject) => {
          const transaction = db.transaction('projects', seed ? 'readwrite' : 'readonly');
          const cursor = transaction.objectStore('projects').openCursor();
          let doc: BoardDoc | undefined;
          cursor.onsuccess = () => {
            const entry = cursor.result;
            if (!entry) return;
            const project = entry.value as { doc: BoardDoc };
            if (project.doc.name !== name) {
              entry.continue();
              return;
            }
            doc = project.doc;
            if (seed) {
              Object.assign(doc, seed);
              entry.update(project);
            }
          };
          transaction.oncomplete = () =>
            doc ? resolve(doc) : reject(new Error('Synthetic acceptance project missing'));
          transaction.onerror = transaction.onabort = () => reject(transaction.error);
        });
      } finally {
        db.close();
      }
    },
    { name, seed },
  );
}

async function clickScene(page: Page, point: Vec2) {
  const { x, y } = await page.locator('svg [data-scene]').evaluate((scene, at) => {
    const matrix = (scene as SVGGraphicsElement).getScreenCTM();
    if (!matrix) throw new Error('Missing scene transform');
    const { x, y } = new DOMPoint(at.x, at.y).matrixTransform(matrix);
    return { x, y };
  }, point);
  await page.mouse.click(x, y);
}

test('schematic_acceptance_end_to_end', async ({ page }) => {
  await createBoard(page, name);
  await dropPhoto(page, canvas(page), await syntheticPhoto(page));
  await expect(photo(page)).toBeVisible();
  const saved = page.getByRole('status').filter({ hasText: 'Salvestatud' });
  await expect(saved).toBeVisible();
  await page.getByRole('button', { name: 'Tagasi avalehele', exact: true }).click();
  await storedBoard(page, existing);
  await page.getByRole('button', { name: `Ava ${name}`, exact: true }).click();
  await expect(photo(page)).toBeVisible();

  const views = page.getByRole('group', { name: 'Vaade', exact: true });
  const schematic = views.getByRole('button', { name: 'Skeem', exact: true });
  const board = views.getByRole('button', { name: 'Plaat', exact: true });
  const context = page.getByRole('complementary', { name: 'Omadused', exact: true });
  const symbol = (id: string) => page.locator(`svg [data-symbol][data-component="${id}"]`);
  const readComponent = async (ref: string) =>
    (await storedBoard(page)).components.find((component) => component.ref === ref);

  await schematic.click();
  await expect(symbol(r2)).toBeVisible();
  await page.getByRole('tab', { name: 'Teek', exact: true }).click();
  const library = page.getByRole('tabpanel', { name: 'Teek', exact: true });
  await library.getByRole('button', { name: 'Takisti SMD', exact: true }).click();
  await library.getByRole('button', { name: 'Paiguta', exact: true }).click();
  await clickScene(page, { x: 212.1, y: 124.3 });
  await page.keyboard.press('Escape');
  await expect.poll(async () => Boolean((await readComponent('R1'))?.schematic)).toBe(true);
  const fromSchematic = (await readComponent('R1'))!;
  expect(fromSchematic.board).toBeUndefined();
  const schematicAt = fromSchematic.schematic!.at;

  await board.click();
  await page.getByRole('tab', { name: 'Komponendid', exact: true }).click();
  await page.getByRole('radio', { name: 'Paigutamata (1)', exact: true }).click();
  const r1Row = page.getByRole('listitem').filter({
    has: page.getByRole('button', { name: 'Vali R1', exact: true }),
  });
  await r1Row.getByRole('button', { name: 'Paiguta plaadile', exact: true }).click();
  await r1Row.getByRole('button', { name: 'Takisti SMD', exact: true }).click();
  await clickScene(page, { x: 420, y: 180 });
  await expect.poll(async () => Boolean((await readComponent('R1'))?.board)).toBe(true);
  const placed = await storedBoard(page);
  expect(placed.components).toHaveLength(3);
  expect(placed.components.find(({ ref }) => ref === 'R1')).toMatchObject({
    id: fromSchematic.id,
    schematic: { at: schematicAt },
    board: { footprint: 'chip' },
  });

  await clickScene(page, existing.components[0]!.board!.center);
  await expect(context.getByRole('heading', { name: 'R2', exact: true })).toBeVisible();
  const reference = context.getByRole('textbox', { name: 'Tähis', exact: true });
  await reference.fill('R5');
  await reference.press('Enter');
  await expect.poll(async () => (await readComponent('R5'))?.id).toBe(r2);
  const renamed = await storedBoard(page);
  expect(renamed.connections).toEqual(placed.connections);
  expect(renamed.measurements).toEqual(placed.measurements);
  await expect(
    page.locator('svg [data-layer="components.labels"]').getByText('R5', { exact: true }),
  ).toBeVisible();

  await clickScene(page, existing.components[1]!.board!.center);
  await expect(context.getByRole('heading', { name: 'U1', exact: true })).toBeVisible();
  await schematic.click();
  await expect(symbol(r2).getByText('R5', { exact: true })).toBeVisible();
  await expect(symbol(u1)).toHaveAttribute('data-selected', 'true');
  await expect(context.getByRole('heading', { name: 'U1', exact: true })).toBeVisible();
  await clickScene(page, existing.components[0]!.schematic!.at);
  await expect(symbol(r2)).toHaveAttribute('data-selected', 'true');
  await expect(symbol(u1)).not.toHaveAttribute('data-selected', 'true');
  await board.click();
  await expect(context.getByRole('heading', { name: 'R5', exact: true })).toBeVisible();
});
