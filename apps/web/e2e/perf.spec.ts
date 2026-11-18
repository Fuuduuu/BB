import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { Snapshot, ViewState } from '@pcbk/contracts';
import { newBoardDoc } from '@pcbk/domain';
import { createEngine } from '@pcbk/engine';
import { engineFeatures, RESERVED_FIELDS } from '@pcbk/features/engine';
import { observeSvgPhoto } from '../../desktop/src/perf/probe-dom';
import { selectDenseTarget } from '../../desktop/src/perf/probe-setup';
import { generateSyntheticBoard } from '../../desktop/src/perf/synthetic-board';
import { createSyntheticPhoto } from '../../desktop/src/perf/synthetic-photo';
import { canvas, center, createBoard, photo } from './photo-flow-helpers';

const name = 'Sünteetiline jõudlusplaat';
const time = '2026-01-01T00:00:00.000Z';
const layer = (kind: 'bodies' | 'pins' | 'labels') => `[data-layer="components.${kind}"]`;
type DenseBoard = ReturnType<typeof buildBoard>;
type Batch = { layers: string[]; components: string[] };
type Probe = { batches: Batch[]; frames: number; stop(): void };
type ProbedSvg = SVGSVGElement & { perfMutations: Probe };

function buildBoard() {
  let sequence = 0;
  const ids = { newId: (prefix: string) => `${prefix}_perf_${++sequence}` };
  const synthetic = generateSyntheticBoard({ seed: 127, ids, at: time });
  const { engine, host } = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => time },
  });
  host.load('session_perf', newBoardDoc(name), false);
  for (const component of synthetic.components) {
    const result = engine.execute('components.add', component);
    if (!result.ok) throw new Error(`Synthetic component: ${JSON.stringify(result.error)}`);
  }
  for (const measurement of synthetic.measurements) {
    const result = engine.execute('measurements.add', measurement);
    if (!result.ok) throw new Error(`Synthetic measurement: ${JSON.stringify(result.error)}`);
  }
  const { components, measurements } = engine.snapshot().doc;
  const target = selectDenseTarget(components, synthetic.surface);
  if (!target?.board) throw new Error('Missing central SOIC on the synthetic board');
  const view: Pick<ViewState, 'contextOpen' | 'boardView'> = {
    contextOpen: false,
    boardView: {
      zoom: 1,
      pan: { x: 520 - target.board.center.x, y: 340 - target.board.center.y },
    },
  };
  return { name, components, measurements, view, targetId: target.id };
}

async function importSyntheticPhoto(page: Page) {
  const image = await page.evaluateHandle(createSyntheticPhoto, 4000);
  try {
    const transfer = await image.evaluateHandle(({ bytes, name }) => {
      const data = new DataTransfer();
      data.items.add(new File([bytes], name, { type: 'image/jpeg' }));
      return data;
    });
    try {
      await canvas(page).dispatchEvent('drop', { dataTransfer: transfer });
      await expect(photo(page)).toHaveAttribute('width', '4000');
      await expect(photo(page)).toHaveAttribute('height', '3000');
    } finally {
      await transfer.dispose();
    }
  } finally {
    await image.dispose();
  }
}

async function openDenseBoard(page: Page, board: DenseBoard, testInfo: TestInfo) {
  await createBoard(page, board.name);
  await importSyntheticPhoto(page);
  await page.getByRole('button', { name: 'Tagasi avalehele', exact: true }).click();
  const open = page.getByRole('button', { name: `Ava ${board.name}`, exact: true });
  await expect(open).toBeVisible();

  // Seed only the isolated browser's closed synthetic project. Keep metadata and the real photo.
  await page.evaluate(async ({ name, components, measurements, view }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('bb-projects');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('projects', 'readwrite');
        let found = false;
        const cursor = tx.objectStore('projects').openCursor();
        cursor.onsuccess = () => {
          const entry = cursor.result;
          if (!entry) return;
          const row = entry.value as { doc: Snapshot['doc']; view: ViewState };
          if (row.doc.name !== name) {
            entry.continue();
            return;
          }
          entry.update({
            ...row,
            doc: { ...row.doc, components, measurements },
            view: { ...row.view, ...view },
          });
          found = true;
        };
        tx.oncomplete = () => (found ? resolve() : reject(new Error('Synthetic project missing')));
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }, board);

  const photoLoad = await page.evaluateHandle(observeSvgPhoto);
  const started = performance.now();
  try {
    await open.click();
    await expect(canvas(page).locator(`${layer('bodies')} [data-component]`)).toHaveCount(300);
    await expect(canvas(page).locator(`${layer('pins')} [data-pin]`)).toHaveCount(3000);
    await expect
      .poll(() =>
        photoLoad.evaluate((watch) => {
          const svg = document.querySelector<SVGSVGElement>('svg[aria-label="Plaat"]');
          return svg !== null && watch.ready(svg);
        }),
      )
      .toBe(true);
    testInfo.annotations.push({
      type: 'open_to_layers_and_photo_ms',
      description: (performance.now() - started).toFixed(1),
    });
  } finally {
    await photoLoad.evaluate((watch) => watch.stop());
    await photoLoad.dispose();
  }
  return center(
    canvas(page)
      .locator(`${layer('bodies')} [data-component="${board.targetId}"] polygon`)
      .first(),
  );
}

async function observe(page: Page) {
  await canvas(page).evaluate(
    (svg: ProbedSvg, selectors) => {
      const root = (node: Node) => (node instanceof Element ? node : node.parentElement);
      const batches: Batch[] = [];
      const mutation = new MutationObserver((records) => {
        const layers = new Set<string>();
        const components = new Set<string>();
        for (const record of records) {
          const target = root(record.target);
          layers.add(target?.closest('[data-layer]')?.getAttribute('data-layer') ?? 'unknown');
          const group = target?.closest('[data-component]');
          if (group) {
            components.add(group.getAttribute('data-component')!);
          } else {
            for (const child of [...record.addedNodes, ...record.removedNodes]) {
              components.add(root(child)?.getAttribute('data-component') ?? 'unknown');
            }
            if (!record.addedNodes.length && !record.removedNodes.length) components.add('unknown');
          }
        }
        batches.push({ layers: [...layers], components: [...components] });
      });
      for (const selector of selectors) {
        const node = svg.querySelector(selector);
        if (!node) throw new Error(`Missing observed layer ${selector}`);
        mutation.observe(node, {
          attributes: true,
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
      let frame = requestAnimationFrame(function count() {
        svg.perfMutations.frames++;
        frame = requestAnimationFrame(count);
      });
      svg.perfMutations = {
        batches,
        frames: 0,
        stop() {
          mutation.disconnect();
          cancelAnimationFrame(frame);
        },
      };
    },
    [layer('bodies'), layer('pins'), layer('labels')],
  );
}

const observed = (page: Page) =>
  canvas(page).evaluate((svg: ProbedSvg) => ({
    batches: svg.perfMutations.batches,
    frames: svg.perfMutations.frames,
    active: svg.style.willChange === 'transform',
  }));

async function finishObservation(page: Page, testInfo: TestInfo, clock: 'controlled' | 'browser') {
  const frames = await canvas(page).evaluate((svg: ProbedSvg) => {
    svg.perfMutations.stop();
    return svg.perfMutations.frames;
  });
  testInfo.annotations.push({ type: 'animation_frames', description: `${frames} (${clock})` });
}

let board: DenseBoard;
test.beforeAll(() => {
  board = buildBoard();
});

test('perf_board_pan_and_zoom_do_not_rerender_layers', async ({ page }, testInfo) => {
  const at = await openDenseBoard(page, board, testInfo);
  const start = new Date(time);
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1000));
  await observe(page);

  await page.mouse.move(at.x, at.y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(at.x + 24, at.y + 18, { steps: 2 });
  expect(await observed(page)).toMatchObject({ active: true, batches: [] });
  await page.mouse.up({ button: 'middle' });
  await page.clock.runFor(160);
  expect(await observed(page)).toMatchObject({ active: false, batches: [] });

  await page.mouse.wheel(0, -600);
  await expect.poll(async () => (await observed(page)).active).toBe(true);
  await page.clock.runFor(100);
  expect(await observed(page)).toMatchObject({ active: true, batches: [] });
  await page.clock.runFor(200);
  await expect.poll(async () => (await observed(page)).batches.length).toBeGreaterThan(0);
  await page.clock.runFor(160);
  const settled = await observed(page);
  expect(settled.active).toBe(false);
  expect(settled.batches).toHaveLength(1);
  expect(settled.batches[0]?.layers).toContain('components.labels');
  await finishObservation(page, testInfo, 'controlled');
});

test('perf_board_drag_rerenders_only_dragged_component', async ({ page }, testInfo) => {
  const at = await openDenseBoard(page, board, testInfo);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await observe(page);
  try {
    await page.mouse.move(at.x + 24, at.y + 18, { steps: 3 });
    await expect.poll(async () => (await observed(page)).batches.length).toBeGreaterThan(0);
    const { batches } = await observed(page);
    expect(new Set(batches.flatMap(({ components }) => components))).toEqual(
      new Set([board.targetId]),
    );
    expect(new Set(batches.flatMap(({ layers }) => layers))).toEqual(
      new Set(['components.bodies', 'components.pins', 'components.labels']),
    );
  } finally {
    await finishObservation(page, testInfo, 'browser');
    await page.mouse.up();
  }
});
