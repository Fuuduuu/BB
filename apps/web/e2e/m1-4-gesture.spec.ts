import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { bounds, canvas, center, createBoard } from './photo-flow-helpers';

type Point = { x: number; y: number };
type Frame = {
  elapsed: number;
  transform: string | null;
  css: string;
  willChange: string;
  numbers: string[];
  anchor: Point | null;
};
type Probe = {
  initial: Frame;
  lastWheel: number;
  wheelAt: Point | null;
  wheels: Frame[];
  commits: Frame[];
  anchorWorld: Point | null;
  pointer?: Frame & { pointerId: number };
};
type ObservedCanvas = SVGSVGElement & { gestureProbe: Probe };
const viewportBounds = (page: Page) => bounds(canvas(page).locator('..'));

async function placeSoic(page: Page, position?: Point) {
  await page.getByRole('tab', { name: 'Teek', exact: true }).click();
  const library = page.getByRole('tabpanel', { name: 'Teek', exact: true });
  await library.getByRole('button', { name: 'SOIC', exact: true }).click();
  await library.getByRole('combobox', { name: 'Jalgu', exact: true }).selectOption('8');
  await library.getByRole('button', { name: 'Paiguta', exact: true }).click();
  const area = await viewportBounds(page);
  const at = position ?? { x: area.x + area.width / 2, y: area.y + area.height / 2 };
  await page.mouse.click(at.x, at.y);
  await expect(page.locator('[data-layer="components.pins"] [data-pin]')).toHaveCount(8);
  await page.keyboard.press('Escape');
}

// These listeners only observe real browser events, CTMs and animation frames.
// No layout, pointer-capture, hit-index or scheduling API is replaced.
async function observe(page: Page, anchor?: Point) {
  return canvas(page).evaluate((element: SVGSVGElement, anchor) => {
    const svg = element as ObservedCanvas;
    const view = svg.querySelector<SVGGElement>('[data-view]')!;
    const scene = svg.querySelector<SVGGElement>('[data-scene]')!;
    const matrix = scene.getScreenCTM()!;
    const world = anchor
      ? new DOMPoint(anchor.x, anchor.y).matrixTransform(matrix.inverse())
      : null;
    const probe: Probe = {
      initial: null!,
      lastWheel: 0,
      wheelAt: null,
      wheels: [],
      commits: [],
      anchorWorld: world ? { x: world.x, y: world.y } : null,
    };
    const snapshot = (): Frame => {
      const point = world?.matrixTransform(scene.getScreenCTM()!);
      return {
        elapsed: performance.now() - probe.lastWheel,
        transform: view.getAttribute('transform'),
        css: svg.style.transform,
        willChange: svg.style.willChange,
        numbers: [...svg.querySelectorAll('[data-layer="components.labels"] text')]
          .map((text) => text.textContent ?? '')
          .filter((text) => /^[1-8]$/.test(text))
          .sort(),
        anchor: point ? { x: point.x, y: point.y } : null,
      };
    };
    probe.initial = snapshot();
    svg.gestureProbe = probe;
    svg.addEventListener(
      'wheel',
      (event) => {
        probe.lastWheel = performance.now();
        probe.wheelAt = { x: event.clientX, y: event.clientY };
        requestAnimationFrame(() => probe.wheels.push(snapshot()));
      },
      { capture: true },
    );
    const changes = new MutationObserver(() => probe.commits.push(snapshot()));
    changes.observe(view, { attributes: true, attributeFilter: ['transform'] });
    svg.addEventListener(
      'pointerdown',
      (event) => {
        // Capture before a selected pin opens the properties pane.
        probe.pointer = { ...snapshot(), pointerId: event.pointerId };
      },
      { capture: true },
    );
    return probe.initial;
  }, anchor);
}

const evidence = (page: Page) =>
  canvas(page).evaluate((svg: SVGSVGElement) => (svg as ObservedCanvas).gestureProbe);

async function wheelFrame(page: Page, deltaY: number) {
  const before = (await evidence(page)).wheels.length;
  await page.mouse.wheel(0, deltaY);
  await expect
    .poll(async () => (await evidence(page)).wheels.length, { intervals: [5] })
    .toBeGreaterThan(before);
  return (await evidence(page)).wheels[before]!;
}

async function settle(page: Page) {
  await canvas(page).evaluate(
    () =>
      new Promise<void>((resolve) => setTimeout(() => requestAnimationFrame(() => resolve()), 125)),
  );
  await expect
    .poll(() => canvas(page).evaluate((svg: SVGSVGElement) => svg.style.transform))
    .toBe('');
}

function active(frame: Frame, initial: Frame) {
  expect(frame.elapsed).toBeLessThan(120);
  expect(frame.transform).toBe(initial.transform);
  expect(frame.css).toMatch(/^matrix\(/);
  expect(frame.willChange).toBe('transform');
}

function anchored(frame: Frame, at: Point) {
  expect(frame.anchor).not.toBeNull();
  expect(Math.abs(frame.anchor!.x - at.x)).toBeLessThan(0.5);
  expect(Math.abs(frame.anchor!.y - at.y)).toBeLessThan(0.5);
}

test('gesture_does_not_touch_svg_transform', async ({ page }) => {
  await createBoard(page, 'Kompositori žest');
  const initial = await observe(page);
  const at = await center(canvas(page));
  await page.mouse.move(at.x, at.y);
  active(await wheelFrame(page, -100), initial);
  active(await wheelFrame(page, -100), initial);
  expect((await evidence(page)).commits).toEqual([]);
});

test('sharp_redraw_after_lod_delay', async ({ page }) => {
  await createBoard(page, 'Terav LOD pärast žesti');
  await placeSoic(page);
  const initial = await observe(page);
  expect(initial.numbers).toEqual([]);
  const at = await center(canvas(page));
  await page.mouse.move(at.x, at.y);
  // SOIC8 pads have a 3px short half-side at zoom 1: exp(1.2) * 3 > 7px.
  const during = await wheelFrame(page, -600);
  active(during, initial);
  expect(during.numbers).toEqual([]);
  await settle(page);
  await expect(
    page.locator('[data-layer="components.labels"] text').filter({ hasText: /^[1-8]$/ }),
  ).toHaveCount(8);
  const committed = (await evidence(page)).commits;
  expect(committed).toHaveLength(1);
  expect(committed[0]!.transform).not.toBe(initial.transform);
  expect(committed[0]!.elapsed).toBeGreaterThanOrEqual(120);
  expect(committed[0]!.css).toBe('');
  expect(committed[0]!.willChange).toBe('');
});

test('pointer_hits_correct_pin_during_gesture', async ({ page }) => {
  for (const delta of [-250, 300]) {
    await createBoard(page, `Jala tabamine žesti ajal ${delta}`);
    await placeSoic(page);
    const pin = page.locator('[data-layer="components.pins"] [data-pin="3"]');
    const before = await center(pin);
    const zoomAt = { x: before.x + 110, y: before.y - 80 };
    const initial = await observe(page);
    await page.mouse.move(zoomAt.x, zoomAt.y);
    let expected = initial;
    if (delta > 0) {
      // Exhaust the zoom-out buffer, then exercise a genuine CSS residual.
      const frame = await wheelFrame(page, 400);
      const commits = (await evidence(page)).commits;
      expect(commits).toHaveLength(1);
      expect(frame.transform).not.toBe(initial.transform);
      expect(commits[0]!.elapsed).toBeLessThan(120);
      expected = { ...initial, transform: frame.transform };
    }
    // Net zoom-out is +300; both zoom directions move the pad before the LOD timer.
    await page.mouse.wheel(0, delta > 0 ? -100 : delta);
    const at = await pin.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });
    expect(Math.hypot(at.x - before.x, at.y - before.y)).toBeGreaterThan(50);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    const captured = await canvas(page).evaluate((svg: SVGSVGElement) =>
      svg.hasPointerCapture((svg as ObservedCanvas).gestureProbe.pointer!.pointerId),
    );
    await page.mouse.up();
    const pointer = (await evidence(page)).pointer;
    expect(pointer).toBeDefined();
    active(pointer!, expected);
    expect(captured).toBe(true);
    await expect(
      page.getByRole('region', { name: 'Mõõda', exact: true }).getByText('U1.3', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('complementary', { name: 'Omadused', exact: true }).getByRole('heading', {
        name: 'U1.3',
        exact: true,
      }),
    ).toBeVisible();
  }
});

test('zoom_keeps_point_under_cursor', async ({ page }) => {
  await createBoard(page, 'Kursori ankur');
  const area = await viewportBounds(page);
  // Chromium wheel events truncate client coordinates to whole CSS pixels.
  const at = {
    x: Math.round(area.x + area.width * 0.37),
    y: Math.round(area.y + area.height * 0.41),
  };
  const initial = await observe(page, at);
  await page.mouse.move(at.x, at.y);
  // Consecutive real wheel events must preserve the same off-centre world anchor.
  for (const delta of [-160, -100]) {
    const frame = await wheelFrame(page, delta);
    expect((await evidence(page)).wheelAt).toEqual(at);
    active(frame, initial);
    anchored(frame, at);
  }
  await settle(page);
  const committed = (await evidence(page)).commits;
  expect(committed).toHaveLength(1);
  anchored(committed.at(-1)!, at);
  // Read the actual post-LOD CTM; a stored wheel frame cannot prove this phase.
  const settledPoint = await canvas(page).evaluate((element: SVGSVGElement) => {
    const world = (element as ObservedCanvas).gestureProbe.anchorWorld!;
    const matrix = element.querySelector<SVGGElement>('[data-scene]')!.getScreenCTM()!;
    const point = new DOMPoint(world.x, world.y).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  });
  expect(Math.abs(settledPoint.x - at.x)).toBeLessThan(0.5);
  expect(Math.abs(settledPoint.y - at.y)).toBeLessThan(0.5);
});

test('gesture_keeps_entering_content_visible', async ({ page }, testInfo) => {
  for (const largePan of [false, true]) {
    await createBoard(page, `Väljast sisse nihutatud jalg ${largePan}`);
    const viewport = await viewportBounds(page);
    await placeSoic(
      page,
      largePan
        ? undefined
        : {
            x: viewport.x + 90,
            y: Math.round(viewport.y + viewport.height / 2),
          },
    );
    const svg = canvas(page);
    const pin = page.locator('[data-layer="components.pins"] [data-pin="3"]');
    const original = await bounds(pin);
    const clip = {
      x: Math.floor(original.x) - 4,
      y: Math.floor(original.y) - 4,
      width: Math.ceil(original.width) + 8,
      height: Math.ceil(original.height) + 8,
    };
    const distance = largePan ? Math.ceil(viewport.width * 0.7) : 160;
    const y = Math.round(viewport.y + viewport.height / 2);
    await page.mouse.move(Math.floor(viewport.x + viewport.width - 40), y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(Math.floor(viewport.x + viewport.width - 40) - distance, y);
    await page.mouse.up({ button: 'middle' });
    await settle(page);
    const outside = await pin.boundingBox();
    expect(outside!.x + outside!.width).toBeLessThan(viewport.x);
    const committed = await svg.locator('[data-view]').getAttribute('transform');
    await svg.evaluate((element: SVGSVGElement) => {
      element.addEventListener(
        'pointermove',
        (event) => {
          if (event.buttons === 4)
            element.setAttribute('data-test-last-pan', String(performance.now()));
        },
        { capture: true },
      );
    });
    const startX = Math.ceil(viewport.x + 40);
    await page.mouse.move(startX, y);
    await page.mouse.down({ button: 'middle' });
    // The large first move recommits; retain a genuine 16px CSS residual afterwards.
    await page.mouse.move(startX + distance - 16, y);
    await page.mouse.move(startX + distance, y);
    const during = await page.screenshot({ clip });
    // Read after screenshot completion: a settled screenshot cannot satisfy this proof.
    const state = await svg.evaluate((element: SVGSVGElement) => ({
      elapsed: performance.now() - Number(element.getAttribute('data-test-last-pan')),
      css: element.style.transform,
      transform: element.querySelector('[data-view]')!.getAttribute('transform'),
    }));
    await page.mouse.up({ button: 'middle' });
    expect(state.elapsed).toBeLessThan(120);
    expect(state.css).toMatch(/^matrix\(/);
    if (largePan) expect(state.transform).not.toBe(committed);
    else expect(state.transform).toBe(committed);
    expect(state.css).not.toBe('matrix(1, 0, 0, 1, 0, 0)');
    await settle(page);
    const after = await page.screenshot({ clip });
    await testInfo.attach(`entering-pin-during-gesture-${largePan}`, {
      body: during,
      contentType: 'image/png',
    });
    await testInfo.attach(`entering-pin-after-settle-${largePan}`, {
      body: after,
      contentType: 'image/png',
    });
    const pixels = await page.evaluate(
      async ({ during, after }) => {
        async function decode(png: string) {
          const data = Uint8Array.from(atob(png), (character) => character.charCodeAt(0));
          const image = await createImageBitmap(new Blob([data], { type: 'image/png' }));
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d')!;
          context.drawImage(image, 0, 0);
          image.close();
          return context.getImageData(0, 0, canvas.width, canvas.height).data;
        }
        const active = await decode(during);
        const settled = await decode(after);
        let painted = 0,
          matching = 0;
        for (let index = 0; index < settled.length; index += 4) {
          const backgroundDistance = [0, 1, 2].reduce(
            (sum, channel) => sum + Math.abs(settled[index + channel]! - settled[channel]!),
            0,
          );
          if (backgroundDistance < 60) continue;
          painted++;
          const difference = [0, 1, 2].reduce(
            (sum, channel) => sum + Math.abs(settled[index + channel]! - active[index + channel]!),
            0,
          );
          if (difference < 40) matching++;
        }
        return { painted, matching };
      },
      { during: during.toString('base64'), after: after.toString('base64') },
    );
    await testInfo.attach(`entering-pin-paint-evidence-${largePan}`, {
      body: JSON.stringify({ ...state, ...pixels }),
      contentType: 'application/json',
    });
    expect(pixels.painted).toBeGreaterThan(30);
    expect(pixels.matching / pixels.painted).toBeGreaterThan(0.9);
  }
});
