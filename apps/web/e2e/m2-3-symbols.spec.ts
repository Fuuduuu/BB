import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { BoardDoc, Component } from '@pcbk/domain';
import { bounds, canvasViewport, center, createBoard } from './photo-flow-helpers';

const name = 'Sünteetiline sümbolite plaat';
const twoPins = ['', ''];
const threePins = ['', '', ''];
const bce = ['B', 'C', 'E'];
const gds = ['G', 'D', 'S'];
const fixture = {
  resistor: ['R1', twoPins],
  capacitor: ['C1', twoPins],
  capacitor_polarized: ['C2', ['+', '−']],
  inductor: ['L1', twoPins],
  diode: ['D1', ['A', 'K']],
  led: ['D2', ['A', 'K']],
  zener: ['D3', ['A', 'K']],
  npn: ['Q1', bce],
  pnp: ['Q2', bce],
  nmos: ['Q3', gds],
  pmos: ['Q4', gds],
  regulator: ['U2', ['IN', 'GND', 'OUT']],
  ic: ['U1', ['VCC', 'IN+', 'IN−', 'OUT', 'GND', 'EN', 'SCL', 'SDA']],
  connector: ['J1', ['VCC', 'GND', 'SIGNAL']],
  crystal: ['Y1', twoPins],
  switch: ['SW1', twoPins],
  fuse: ['F1', twoPins],
  testpoint: ['TP1', ['']],
  via: ['V1', ['']],
  pad: ['P1', ['']],
  wire_point: ['W1', ['']],
  hole: ['H1', []],
  other: ['X1', ['AUX', 'GND', 'OUT']],
} satisfies Record<Component['kind'], [string, string[]]>;

function schematicParts(): Component[] {
  let index = 0;
  function part(
    kind: Component['kind'],
    ref: string,
    pinNames: readonly string[],
    id = `cmp_${kind}`,
  ): Component {
    const slot = kind === 'via' || kind === 'hole' ? 0 : index++;
    return {
      id,
      ref,
      kind,
      marking: '',
      value: '',
      identified: true,
      dnp: false,
      note: '',
      pins: pinNames.map((name, pin) => ({
        id: String(pin + 1),
        uid: `pin_${id}_${pin + 1}`,
        ...(name && { name }),
        nc: false,
      })),
      schematic: {
        symbol: 'seeded_symbol',
        at: { x: (55 + (slot % 6) * 11) * 2.54, y: (43 + Math.floor(slot / 6) * 10) * 2.54 },
        rot: 0,
        mirror: false,
      },
    };
  }

  return [
    ...Object.entries(fixture).map(([kind, [ref, names]]) =>
      part(kind as Component['kind'], ref, names),
    ),
    part('npn', 'Q5', threePins, 'cmp_npn_box'),
  ];
}

async function seedSchematic(page: Page) {
  await page.evaluate(
    async ({ name, components }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('bb-projects', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction('projects', 'readwrite');
          const cursor = transaction.objectStore('projects').openCursor();
          let updated = false;
          cursor.onsuccess = () => {
            const entry = cursor.result;
            if (!entry) return;
            const project = entry.value as { doc: BoardDoc };
            if (project.doc.name !== name) {
              entry.continue();
              return;
            }
            project.doc.components = components;
            entry.update(project);
            updated = true;
          };
          transaction.oncomplete = () =>
            updated ? resolve() : reject(new Error('Synthetic schematic project missing'));
          transaction.onerror = transaction.onabort = () => reject(transaction.error);
        });
      } finally {
        db.close();
      }
    },
    { name, components: schematicParts() },
  );
}

test.use({ viewport: { width: 1600, height: 1000 } });

test('schematic_symbols_render_every_kind', async ({ page }, testInfo) => {
  await createBoard(page, name);
  const saved = page.getByRole('status').filter({ hasText: 'Salvestatud' });
  const home = page.getByRole('button', { name: 'Tagasi avalehele', exact: true });
  await expect(saved).toBeVisible();
  await home.click();
  await seedSchematic(page);

  const items = page.locator('svg [data-symbol]');
  const q1 = page.locator('svg [data-symbol][data-component="cmp_npn"]');
  const zoom = page.locator('.pcbk-view-controls').getByText(/^\d+ %$/);
  const readZoom = async () => Number.parseInt(await zoom.innerText(), 10);
  for (const theme of ['light', 'dark'] as const) {
    await page.getByRole('combobox', { name: 'Välimus', exact: true }).selectOption(theme);
    await page.getByRole('button', { name: `Ava ${name}`, exact: true }).click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await page
      .getByRole('group', { name: 'Vaade', exact: true })
      .getByRole('button', { name: 'Skeem', exact: true })
      .click();

    await expect(items).toHaveCount(22);
    await expect(page.locator('[data-component="cmp_npn_box"]')).toHaveAttribute(
      'data-symbol',
      'box',
    );
    await expect(
      page.locator('[data-component="cmp_via"], [data-component="cmp_hole"]'),
    ).toHaveCount(0);
    await expect(page.getByText('Skeemil pole veel komponente.', { exact: true })).toHaveCount(0);

    for (let step = 0; step < 8 && (await readZoom()) < 150; step++) {
      const previous = await readZoom();
      await page.getByRole('button', { name: 'Suurenda', exact: true }).click();
      await expect.poll(readZoom).toBeGreaterThan(previous);
    }
    expect(await readZoom()).toBeGreaterThanOrEqual(150);
    const viewport = await bounds(canvasViewport(page));
    const rectangles = await items.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().toJSON()),
    );
    for (const rect of rectangles) {
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
      expect(rect.left).toBeGreaterThanOrEqual(viewport.x);
      expect(rect.top).toBeGreaterThanOrEqual(viewport.y);
      expect(rect.right).toBeLessThanOrEqual(viewport.x + viewport.width);
      expect(rect.bottom).toBeLessThanOrEqual(viewport.y + viewport.height);
    }
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(saved).toBeVisible();
    await page.mouse.move(0, 0);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: testInfo.outputPath(`symbols-${theme}.png`),
      animations: 'disabled',
    });

    const { x, y } = await center(q1);
    await page.mouse.click(x, y);
    const properties = page.getByRole('complementary', { name: 'Omadused', exact: true });
    await expect(properties.getByRole('heading', { name: 'Q1', exact: true })).toBeVisible();
    await expect(q1).toHaveAttribute('data-selected', 'true');
    await home.click();
  }
});
