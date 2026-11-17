import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page, test as playwrightTest } from '@playwright/test';

type Box = { left: number; top: number; right: number; bottom: number };

function hasArea(box: Box) {
  return box.right > box.left && box.bottom > box.top;
}

function overlap(a: Box, b: Box) {
  return (
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  );
}

type LabelBox = { text: string | null; componentId: string | null; box: Box };

export function j29RefPinOverlap(labels: LabelBox[]): number | null {
  const ref = labels.find((item) => item.text === 'J29 ?');
  if (!ref?.componentId || !hasArea(ref.box)) return null;
  const own = labels.filter((item) => item.componentId === ref.componentId);
  const value = own.find((item) => item.text === 'LONG CONNECTOR VALUE');
  if (!value || !hasArea(value.box)) return null;
  let area = 0;
  for (let number = 1; number <= 15; number++) {
    const pin = own.find((item) => item.text === String(number));
    if (!pin || !hasArea(pin.box)) return null;
    area += overlap(ref.box, pin.box) + overlap(value.box, pin.box);
  }
  return area;
}

// Runs inside Chromium. Observe the accepted E2E's real rotate/mirror actions without
// copying its project setup, gesture sequence or IDB fixture into this tool.
export function installProbe() {
  const box = (element: Element) => {
    const { left, top, right, bottom } = element.getBoundingClientRect();
    return { left, top, right, bottom };
  };
  const textBoxes = (layer: string) =>
    Array.from(document.querySelectorAll(`[data-layer="${layer}"] text`), (element) => ({
      text: element.textContent,
      componentId: element.closest('[data-component]')?.getAttribute('data-component') ?? null,
      box: box(element),
      font: getComputedStyle(element).fontFamily,
    }));
  const scenes = new Map<string, { canvas: Box; reference: Box; reading: Box }>();
  const scene = () => document.querySelector('[data-scene]');
  new MutationObserver(() => {
    const stage = scene();
    // The SVG includes overscan; its parent clips it to the visible canvas.
    const viewport = stage?.closest('svg')?.parentElement;
    const matrix = stage?.getAttribute('transform');
    if (!viewport || !matrix || !document.querySelector('image[data-layer="photo.image"]')) return;
    const reference = textBoxes('components.labels').find((item) => item.text === 'J29 ?');
    const reading = textBoxes('measurements.readings').find((item) => item.text === '3,651 V');
    if (reference && reading)
      scenes.set(matrix, { canvas: box(viewport), reference: reference.box, reading: reading.box });
  }).observe(document, { childList: true, attributes: true, subtree: true });
  function measure() {
    const viewport = scene()?.closest('svg')?.parentElement;
    const leaders = Array.from(
      document.querySelectorAll('[data-layer="measurements.readings"] line'),
      (line) => {
        const style = getComputedStyle(line);
        // SVG stroke accepts 'none' as well as CSS colors. Let Chromium resolve the
        // actual paint alpha, including transparent rgba() and modern color syntax.
        const paint = document.createElement('canvas').getContext('2d')!;
        paint.fillStyle = 'transparent';
        paint.fillStyle = style.stroke;
        paint.fillRect(0, 0, 1, 1);
        return {
          box: box(line),
          stroke: style.stroke,
          strokeAlpha: paint.getImageData(0, 0, 1, 1).data[3]! / 255,
          rendered: line.checkVisibility({ opacityProperty: true, visibilityProperty: true }),
          opacity: Number(style.opacity) * Number(style.strokeOpacity),
          strokeWidth: style.strokeWidth,
          vectorEffect: style.vectorEffect,
          visibility: style.visibility,
          display: style.display,
        };
      },
    );
    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio,
      },
      theme: document.documentElement.dataset.theme,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      canvas: viewport ? box(viewport) : null,
      labels: textBoxes('components.labels'),
      readings: textBoxes('measurements.readings'),
      leaders,
      matrix: scene()?.getAttribute('transform'),
    };
  }
  const probe = {
    measure,
    scenes: () => Array.from(scenes, ([matrix, boxes]) => ({ matrix, ...boxes })),
  };
  (window as Window & { bbCardProof?: typeof probe }).bbCardProof = probe;
  return probe;
}

declare global {
  interface Window {
    bbCardProof?: ReturnType<typeof installProbe>;
  }
}

// Return the existing synthetic project to its unrotated photo for the leader screenshot.
async function restorePhotoOrientation(page: Page) {
  const scene = page.locator('[data-scene]');
  const matrix = () =>
    scene.evaluate((element) => {
      const m = (element as unknown as SVGGElement).transform.baseVal.getItem(0).matrix;
      return [m.a, m.b, m.c, m.d];
    });
  async function transform(action: string) {
    const before = await scene.getAttribute('transform');
    await page.getByRole('button', { name: 'Foto sätted', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Foto sätted', exact: true })
      .getByRole('button', { name: action, exact: true })
      .click();
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      (before) => document.querySelector('[data-scene]')?.getAttribute('transform') !== before,
      before,
    );
  }
  const [a, b, c, d] = (await matrix()) as [number, number, number, number];
  if (a * d - b * c < 0) await transform('Peegelda');
  for (let turn = 0; turn < 3 && (await matrix())[0] !== 1; turn++) await transform('Pööra 90°');
  assert.deepEqual(await matrix(), [1, 0, 0, 1], 'Foto peab olema pööramata ja peegeldamata.');
}

export function onCanvas(canvas: Box | null, item: Box) {
  return (
    canvas &&
    item.left >= canvas.left &&
    item.right <= canvas.right &&
    item.top >= canvas.top &&
    item.bottom <= canvas.bottom
  );
}

async function pinRowDirection(page: Page) {
  return page.locator('[data-layer="components.pins"]').evaluate((layer) => {
    const center = (number: string) => {
      const rect = layer.querySelector(`[data-pin="${number}"]`)!.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };
    const first = center('1');
    const last = center('15');
    return { x: Math.round(last.x - first.x), y: Math.round(last.y - first.y) };
  });
}

export function registerJ29Proof(test: typeof playwrightTest, artifactDir: string) {
  const issues: string[] = [];
  test.beforeEach(async ({ page }, info) => {
    const theme = info.project.name;
    assert.ok(theme === 'light' || theme === 'dark', 'Tõend vajab heledat või tumedat teemat.');
    issues.length = 0;
    page.on('pageerror', (error) => issues.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') issues.push(message.text());
    });
    await page.addInitScript(installProbe);
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Välimus', exact: true }).selectOption(theme);
    await test.expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  });
  test.afterEach(async ({ page }, info) => {
    const theme = info.project.name;
    const isJ29 = info.title === 'j29_reading_does_not_overlap_ref_label';
    assert.ok(isJ29 || info.title === 'adjacent_readings_do_not_overlap', 'Tundmatu tõendusjuht.');
    const stem = join(artifactDir, (isJ29 ? 'j29-' : 'adjacent-') + theme);
    const scenes = await page.evaluate(() => window.bbCardProof?.scenes() ?? []);
    const transforms = scenes.map((s) => ({ ...s, overlapPx2: overlap(s.reference, s.reading) }));
    let autoRefPinOverlapPx2: number | null = null;
    try {
      assert.equal(info.status, 'passed', 'Kaardi algne E2E ei läbinud.');
      if (isJ29) {
        assert.equal(transforms.length, 8, 'Kõik kaheksa fototeisendust peavad olema mõõdetud.');
        for (const { matrix, canvas, reference, reading, overlapPx2 } of transforms) {
          assert.ok(
            hasArea(reference) && onCanvas(canvas, reference),
            `J29 tähis pole lõuendil (${matrix}).`,
          );
          assert.ok(
            hasArea(reading) && onCanvas(canvas, reading),
            `J29 näit pole lõuendil (${matrix}).`,
          );
          assert.equal(overlapPx2, 0, `J29 tähis kattub näiduga (${matrix}).`);
        }
        await restorePhotoOrientation(page);
        await page.getByRole('button', { name: 'Peida foto', exact: true }).click();
        await page.getByRole('tab', { name: 'Komponendid', exact: true }).click();
        await page.getByRole('button', { name: 'Vali J29', exact: true }).click();
        // The pinned proof positions pin 15 directly above pin 1, beside the long value.
        // Check the committed component, since stamp preview rotation can differ.
        let direction = await pinRowDirection(page);
        for (let turn = 0; turn < 3 && (direction.x !== 0 || direction.y >= 0); turn++) {
          const before = direction;
          await page.getByRole('button', { name: 'Pööra −90°', exact: true }).click();
          await test.expect.poll(() => pinRowDirection(page)).not.toEqual(before);
          direction = await pinRowDirection(page);
        }
        assert.ok(direction.x === 0 && direction.y < 0, 'Jalg 15 peab olema üleval.');
        const value = page.getByRole('textbox', { name: 'Väärtus või mudel', exact: true });
        await value.fill('LONG CONNECTOR VALUE');
        await value.press('Enter');
        await test
          .expect(
            page
              .locator('[data-layer="components.labels"] text')
              .filter({ hasText: 'LONG CONNECTOR VALUE' }),
          )
          .toHaveCount(1);
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        const autoLabels = await page.evaluate(() => window.bbCardProof!.measure().labels);
        autoRefPinOverlapPx2 = j29RefPinOverlap(autoLabels);
        // Deliberately block the near placements: drag the reference onto the measured pin.
        const ref = page
          .locator('[data-layer="components.labels"] text')
          .filter({ hasText: 'J29 ?' });
        const pin = page.locator('[data-layer="components.pins"] [data-pin="15"]');
        const from = await ref.boundingBox();
        const to = await pin.boundingBox();
        assert.ok(from && to);
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
        await page.mouse.up();
        await test.expect(page.locator('[data-layer="measurements.readings"] line')).toHaveCount(1);
      }
      await test.expect(page.getByRole('status').filter({ hasText: 'Salvestatud' })).toBeVisible();
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const sample = await page.evaluate(() => window.bbCardProof!.measure());
      assert.equal(sample.theme, theme);
      assert.equal(sample.colorScheme, theme);
      assert.deepEqual(sample.viewport, { width: 1280, height: 800, dpr: 1 });
      const [reading, second] = sample.readings;
      assert.ok(
        reading &&
          reading.text === '3,651 V' &&
          hasArea(reading.box) &&
          onCanvas(sample.canvas, reading.box),
      );
      const reference = sample.labels.find((l) => l.text === 'J29 ?');
      const value = sample.labels.find((l) => l.text === 'LONG CONNECTOR VALUE');
      const other = isJ29 ? reference : second;
      assert.ok(other && hasArea(other.box) && onCanvas(sample.canvas, other.box));
      const overlapPx2 = overlap(reading.box, other.box);
      const valueOverlapPx2 = value ? overlap(reading.box, value.box) : null;
      const gapX =
        Math.max(reading.box.left, other.box.left) - Math.min(reading.box.right, other.box.right);
      assert.equal(overlapPx2, 0, 'Tekstikastid kattuvad.');
      if (isJ29) {
        assert.ok(value && hasArea(value.box) && onCanvas(sample.canvas, value.box));
        assert.equal(valueOverlapPx2, 0, 'Komponendi väärtus kattub näiduga.');
        assert.ok(
          sample.leaders.some(
            (line) =>
              line.stroke !== 'none' &&
              line.strokeAlpha > 0 &&
              line.rendered &&
              line.opacity > 0 &&
              line.strokeWidth === '1px' &&
              line.visibility === 'visible' &&
              line.display !== 'none' &&
              line.vectorEffect === 'non-scaling-stroke' &&
              onCanvas(sample.canvas, line.box) &&
              (line.box.right > line.box.left || line.box.bottom > line.box.top),
          ),
          'J29 näidu viitejoon peab olema nähtav.',
        );
      } else {
        assert.equal(sample.readings.length, 2);
        assert.equal(second?.text, '3,651 V');
      }
      assert.deepEqual(issues, [], 'Rakenduse konsooli- või käitusviga.');
      await page.screenshot({ path: stem + '.png', animations: 'disabled' });
      await writeFile(
        stem + '.json',
        JSON.stringify(
          {
            ok: true,
            test: info.title,
            ...sample,
            transforms,
            overlapPx2,
            valueOverlapPx2,
            ...(isJ29
              ? { refPinOverlapPx2: j29RefPinOverlap(sample.labels), autoRefPinOverlapPx2 }
              : {}),
            gapX,
            issues,
          },
          null,
          2,
        ) + '\n',
      );
    } catch (error) {
      await page.screenshot({ path: stem + '-failure.png', timeout: 3000 }).catch(() => {});
      const sample = await page.evaluate(() => window.bbCardProof?.measure()).catch(() => null);
      await writeFile(
        stem + '-failure.json',
        JSON.stringify(
          { test: info.title, error: String(error), sample, transforms, issues },
          null,
          2,
        ) + '\n',
      );
      throw error;
    }
  });
}
