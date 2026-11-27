import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { BoardDoc, Component, Vec2 } from '@pcbk/domain';
import { createBoard } from './photo-flow-helpers';

const name = 'Sünteetiline skeemi paigutus';
const grid = 2.54;
type Placement = Pick<NonNullable<Component['schematic']>, 'at' | 'rot' | 'mirror'>;
type Scene = Record<string, Placement>;

function component(ref: string, kind: Component['kind'], names: readonly string[]): Component {
  const id = `cmp_${ref.toLowerCase()}`;
  return {
    id,
    ref,
    kind,
    marking: '',
    value: '',
    identified: true,
    dnp: false,
    note: '',
    pins: names.map((name, index) => ({
      id: String(index + 1),
      uid: `pin_${id}_${index + 1}`,
      ...(name && { name }),
      nc: false,
    })),
  };
}

async function storedBoard(page: Page, components?: Component[]): Promise<BoardDoc> {
  return page.evaluate(
    async ({ name, components }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('bb-projects', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        return await new Promise<BoardDoc>((resolve, reject) => {
          const transaction = db.transaction('projects', components ? 'readwrite' : 'readonly');
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
            if (components) {
              doc.components = components;
              entry.update(project);
            }
          };
          transaction.oncomplete = () =>
            doc ? resolve(doc) : reject(new Error('Synthetic schematic project missing'));
          transaction.onerror = transaction.onabort = () => reject(transaction.error);
        });
      } finally {
        db.close();
      }
    },
    { name, components },
  );
}

async function screenPoint(page: Page, point: Vec2): Promise<Vec2> {
  return page.locator('svg [data-scene]').evaluate((scene, point) => {
    const matrix = (scene as SVGGraphicsElement).getScreenCTM();
    if (!matrix) throw new Error('Missing schematic screen transform');
    const { x, y } = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x, y };
  }, point);
}

function atGrid(point: Vec2): Vec2 {
  return { x: Math.round(point.x / grid) * grid, y: Math.round(point.y / grid) * grid };
}

test.use({ viewport: { width: 1600, height: 1000 } });

test('schematic_place_move_rotate_undo', async ({ page }, testInfo) => {
  // Seven edits and seven undos each wait for the debounced project save.
  test.setTimeout(60_000);
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Välimus', exact: true }).selectOption('light');
  await createBoard(page, name);
  const saved = page.getByRole('status').filter({ hasText: 'Salvestatud' });
  await expect(saved).toBeVisible();
  await page.getByRole('button', { name: 'Tagasi avalehele', exact: true }).click();
  await storedBoard(page, [
    component('R1', 'resistor', ['', '']),
    component('Q1', 'npn', ['B', 'C', 'E']),
    component('U1', 'ic', ['VCC', 'IN', 'OUT', 'GND']),
  ]);
  await page.getByRole('button', { name: `Ava ${name}`, exact: true }).click();
  await page
    .getByRole('group', { name: 'Vaade', exact: true })
    .getByRole('button', { name: 'Skeem', exact: true })
    .click();
  await page.getByRole('radio', { name: 'Paigutamata (3)', exact: true }).click();

  const history: Scene[] = [{}];
  const readScene = async (): Promise<Scene> => {
    const doc = await storedBoard(page);
    expect(doc.components).toHaveLength(3);
    const actual: Scene = {};
    for (const { ref, schematic } of doc.components) {
      if (!schematic) continue;
      const { at, rot, mirror } = schematic;
      for (const mm of [at.x, at.y]) {
        expect(mm / grid).toBeCloseTo(Math.round(mm / grid), 9);
      }
      actual[ref] = { at, rot, mirror };
    }
    return actual;
  };

  async function record(ref: string, placement?: Placement) {
    const expected = { ...history.at(-1)! };
    if (placement) expected[ref] = placement;
    else delete expected[ref];
    await expect.poll(readScene).toEqual(expected);
    history.push(expected);
  }

  const zoom = page.locator('.pcbk-view-controls').getByText(/^\d+ %$/);
  const readZoom = async () => Number.parseInt(await zoom.innerText(), 10);
  for (let step = 0; step < 8 && (await readZoom()) < 150; step++) {
    const previous = await readZoom();
    await page.getByRole('button', { name: 'Suurenda', exact: true }).click();
    await expect.poll(readZoom).toBeGreaterThan(previous);
  }
  expect(await readZoom()).toBeGreaterThanOrEqual(150);

  for (const [ref, point] of [
    ['R1', { x: 155.1, y: 144 }],
    ['Q1', { x: 193.3, y: 141.8 }],
    ['U1', { x: 231.3, y: 141.8 }],
  ] as const) {
    const row = page.getByRole('listitem').filter({
      has: page.getByRole('button', { name: `Vali ${ref}`, exact: true }),
    });
    await row.getByRole('button', { name: 'Paiguta skeemile', exact: true }).click();
    const { x, y } = await screenPoint(page, point);
    await page.mouse.click(x, y);
    await record(ref, { at: atGrid(point), rot: 0, mirror: false });
  }

  const resistor = history.at(-1)!.R1!;
  const end = { x: resistor.at.x + 4.2, y: resistor.at.y + 11.8 };
  const dragStart = await screenPoint(page, resistor.at);
  const dragEnd = await screenPoint(page, end);
  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 8 });
  await page.mouse.up();
  await record('R1', { ...resistor, at: atGrid(end) });

  const transistor = history.at(-1)!.Q1!;
  const center = await screenPoint(page, transistor.at);
  await page.mouse.click(center.x, center.y);
  await page.keyboard.press('r');
  await record('Q1', { ...transistor, rot: 90 });
  await page.keyboard.press('f');
  await record('Q1', { ...transistor, rot: 90, mirror: true });

  const ref = page
    .locator('svg [data-symbol][data-component="cmp_q1"]')
    .getByText('Q1', { exact: true });
  await expect(ref).toBeVisible();
  const basis = await ref.evaluate((text) => {
    const matrix = (text as SVGGraphicsElement).getCTM()!;
    return { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d };
  });
  expect(basis.b).toBeCloseTo(0);
  expect(basis.c).toBeCloseTo(0);
  expect(basis.a).toBeGreaterThan(0);
  expect(basis.d).toBeGreaterThan(0);
  await expect(page.locator('svg [data-symbol]')).toHaveCount(3);
  await expect(saved).toBeVisible();
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath('placed-light.png'), animations: 'disabled' });

  const ic = await screenPoint(page, history.at(-1)!.U1!.at);
  await page.mouse.click(ic.x, ic.y, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Eemalda skeemilt', exact: true }).click();
  await record('U1');

  for (const previous of history.slice(0, -1).reverse()) {
    await page.keyboard.press('Control+z');
    await expect.poll(readScene).toEqual(previous);
  }
});
