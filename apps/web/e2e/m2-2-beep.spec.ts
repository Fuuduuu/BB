import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { BoardDoc, Component } from '@pcbk/domain';
import {
  canvas,
  center,
  createBoard,
  dropPhoto,
  photo,
  syntheticPhoto,
} from './photo-flow-helpers';

const name = 'Piiksu vastuvõtt';
const left = 'cmp_beep_left';
const right = 'cmp_beep_right';
const resistor = 'cmp_beep_resistor';

type Point = { x: number; y: number };
type Pad = { local: Point; sizeMm: number };
type SavedBeep = { at: string; ref: string; beep: boolean; source?: 'manual' | 'beep_mode' };

function part(
  id: string,
  ref: string,
  kind: Component['kind'],
  x: number,
  y: number,
  pads: Record<string, Pad>,
): Component {
  return {
    id,
    ref,
    kind,
    marking: '',
    value: kind === 'resistor' ? '10 Ω' : '',
    identified: true,
    dnp: false,
    note: '',
    pins: Object.keys(pads).map((p) => ({ id: p, uid: uid(id, p), nc: false })),
    board: {
      footprint: 'area',
      params: { w: 10, h: 6 },
      center: { x, y },
      side: 'top',
      rotationDeg: 0,
      scaleX: 1,
      scaleY: 1,
      customPads: Object.fromEntries(
        Object.entries(pads).map(([p, pad]) => [p, { ...pad, shape: 'circle', through: true }]),
      ),
    },
  };
}

const fixture = [
  part(left, 'U1', 'connector', 160, 100, {
    '1': { local: { x: -4, y: 0 }, sizeMm: 2 },
    '2': { local: { x: -2.5, y: 0 }, sizeMm: 0.5 },
    '3': { local: { x: 6, y: 16 }, sizeMm: 1.2 },
  }),
  part(right, 'U2', 'connector', 500, 100, {
    '1': { local: { x: 0, y: 0 }, sizeMm: 1.2 },
    '2': { local: { x: 0, y: 12 }, sizeMm: 1.2 },
  }),
  part(resistor, 'R1', 'resistor', 390, 340, {
    '1': { local: { x: -2, y: 0 }, sizeMm: 1.2 },
    '2': { local: { x: 2, y: 0 }, sizeMm: 1.2 },
  }),
];

function uid(component: string, p: string) {
  return 'pin_' + component + '_' + p;
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
              // Only the isolated test board is seeded; all electrical edits use the visible UI.
              doc.scale.pxPerMm = 10;
              doc.components = components;
              entry.update(project);
            }
          };
          transaction.oncomplete = () =>
            doc ? resolve(doc) : reject(new Error('Synthetic project missing'));
          transaction.onerror = transaction.onabort = () => reject(transaction.error);
        });
      } finally {
        db.close();
      }
    },
    { name, components },
  );
}

async function expectSaved(
  page: Page,
  measurements: number,
  connections: number,
  latest?: SavedBeep,
) {
  await expect
    .poll(async () => {
      const doc = await storedBoard(page);
      const last = doc.measurements.at(-1);
      return {
        measurements: doc.measurements.length,
        connections: doc.connections.length,
        ...(latest && {
          last: {
            mode: last?.mode,
            at: last?.at.uid,
            ref: last?.ref?.uid,
            beep: last?.beep,
            source: last?.source,
          },
        }),
      };
    })
    .toEqual({
      measurements,
      connections,
      ...(latest && {
        last: { mode: 'continuity', source: 'beep_mode', ...latest },
      }),
    });
}

const pin = (page: Page, component: string, p: string) =>
  page.locator(
    '[data-layer="components.pins"] [data-component="' + component + '"] [data-pin="' + p + '"]',
  );
const hud = (page: Page) => page.locator('[data-beep-hud]');
const airMarks = (page: Page) =>
  page.locator('[data-layer="connections.airLines"] text').getByText('✓', { exact: true });
const traceMarks = (page: Page) =>
  page.locator('[data-layer="connections.traces"] text').getByText('✓', { exact: true });

async function clickPin(page: Page, component: string, p: string) {
  const { x, y } = await center(pin(page, component, p));
  await page.mouse.click(x, y);
}

async function pressCanvas(page: Page, key: string) {
  await canvas(page).focus();
  await page.keyboard.press(key);
}

async function clickDensePad(page: Page) {
  const exact = await center(pin(page, left, '1'));
  const expanded = await center(pin(page, left, '2'));
  // 9.5 of 15 world pixels: inside U1.1 by 0.5 px and outside U1.2 by 3 px.
  await page.mouse.click(exact.x + ((expanded.x - exact.x) * 9.5) / 15, exact.y);
}

test('beep_flow_end_to_end', async ({ page }) => {
  await createBoard(page, name);
  await page.getByRole('button', { name: 'Tagasi avalehele', exact: true }).click();
  await storedBoard(page, fixture);
  await page.getByRole('button', { name: 'Ava ' + name, exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await dropPhoto(page, canvas(page), await syntheticPhoto(page));
  await expect(photo(page)).toBeVisible();
  await expectSaved(page, 0, 0);

  const pair: SavedBeep = { at: uid(left, '1'), ref: uid(right, '1'), beep: true };

  await test.step('Enter saves the exact pad and one undo removes the complete change', async () => {
    await pressCanvas(page, 'b');
    await clickPin(page, right, '1');
    await expect(page.getByText('Must sond · U2.1', { exact: true })).toBeVisible();
    await clickDensePad(page);
    await expect(hud(page).getByRole('button', { name: 'Piiksub ja ühenda' })).toBeVisible();
    await pressCanvas(page, 'Enter');
    await expectSaved(page, 1, 1, pair);
    await expect(airMarks(page)).toHaveCount(1);

    await pressCanvas(page, 'Control+z');
    await expectSaved(page, 0, 0);
    await expect(airMarks(page)).toHaveCount(0);
  });

  await test.step('Shift+Enter and N save measurements, Escape closes without saving', async () => {
    await clickPin(page, right, '2');
    await pressCanvas(page, 'Shift+Enter');
    await expectSaved(page, 1, 0, { at: uid(right, '2'), ref: uid(right, '1'), beep: true });

    await clickPin(page, left, '2');
    await pressCanvas(page, 'n');
    await expectSaved(page, 2, 0, { at: uid(left, '2'), ref: uid(right, '1'), beep: false });

    await clickPin(page, left, '3');
    await expect(hud(page)).toBeVisible();
    const before = await storedBoard(page);
    await pressCanvas(page, 'Escape');
    await expect(hud(page)).toBeHidden();
    expect(await storedBoard(page)).toEqual(before);
    await pressCanvas(page, 'Escape');
  });

  await test.step('A resistor warns and declining keeps just the measurement', async () => {
    await pressCanvas(page, 'b');
    await clickPin(page, resistor, '1');
    await clickPin(page, resistor, '2');
    await pressCanvas(page, 'Enter');
    const dialog = page.getByRole('dialog', {
      name: 'Piiksub läbi komponendi R1. Ühendan ikkagi?',
      exact: true,
    });
    await expect(dialog).toBeVisible();
    const resistorPair = { at: uid(resistor, '2'), ref: uid(resistor, '1'), beep: true };
    await expectSaved(page, 3, 0, resistorPair);
    await dialog.getByRole('button', { name: 'Jäta ühendamata', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expectSaved(page, 3, 0, resistorPair);
    await pressCanvas(page, 'Escape');
  });

  await test.step('Enter in the toolbar activates its button only', async () => {
    await pressCanvas(page, 'b');
    await clickPin(page, right, '1');
    await clickDensePad(page);
    await expect(hud(page)).toBeVisible();
    const before = await storedBoard(page);
    const hide = page.getByRole('button', { name: 'Peida navigaator', exact: true });
    await hide.focus();
    await expect(hide).toBeFocused();
    await page.keyboard.press('Enter');
    const show = page.getByRole('button', { name: 'Näita navigaatorit', exact: true });
    await expect(show).toBeVisible();
    await expect(hud(page)).toBeVisible();
    expect(await storedBoard(page)).toEqual(before);
    await show.click();

    await pressCanvas(page, 'Enter');
    await expectSaved(page, 4, 1, pair);
    await expect(airMarks(page)).toHaveCount(1);
    await pressCanvas(page, 'Escape');
  });

  await test.step('Draw the measured air line and branch while retaining both marks', async () => {
    const a = await center(pin(page, right, '1'));
    const b = await center(pin(page, left, '1'));
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    const shapes = page.locator('[data-layer="connections.traces"] polyline');

    await page.mouse.click(x, y, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Joonista rada fotol', exact: true }).click();
    await page.mouse.click(b.x, b.y);
    await expectSaved(page, 4, 1, pair);
    await expect(shapes).toHaveCount(1);
    await expect(airMarks(page)).toHaveCount(0);
    await expect(traceMarks(page)).toHaveCount(1);

    await clickPin(page, left, '3');
    await page.mouse.click(x, y);
    await expectSaved(page, 4, 3, pair);
    await expect(shapes).toHaveCount(3);
    await expect(traceMarks(page)).toHaveCount(2);
    const doc = await storedBoard(page);
    expect(doc.junctions).toHaveLength(1);
    const splitX = doc.junctions[0]?.board?.at.x;
    expect(splitX).toBeDefined();
    expect(
      await traceMarks(page).evaluateAll((marks) =>
        marks.map((mark) => Number(mark.getAttribute('x'))).sort((a, b) => a - b),
      ),
    ).toEqual([(120 + splitX!) / 2, (500 + splitX!) / 2]);
    await pressCanvas(page, 'Escape');
  });

  await test.step('Delete the evidence and restore it through the ordinary Measure block', async () => {
    await page.getByRole('tab', { name: 'Mõõtmised', exact: true }).click();
    const measurements = page.getByRole('tabpanel', { name: 'Mõõtmised', exact: true });
    await measurements
      .getByRole('button', { name: 'Kustuta mõõtmine piiksub U1.1 → U2.1', exact: true })
      .click();
    await expectSaved(page, 3, 3);
    await expect(traceMarks(page)).toHaveCount(0);

    await clickPin(page, left, '1');
    const measure = page.getByRole('region', { name: 'Mõõda', exact: true });
    await measure.getByRole('combobox', { name: 'Režiim' }).selectOption('continuity');
    await measure.getByRole('button', { name: 'Vali musta sondi jalg', exact: true }).click();
    await clickPin(page, right, '1');
    await measure.getByRole('button', { name: 'Piiksub', exact: true }).click();
    await expectSaved(page, 4, 3, { ...pair, source: 'manual' });
    await expect(traceMarks(page)).toHaveCount(2);
  });
});
