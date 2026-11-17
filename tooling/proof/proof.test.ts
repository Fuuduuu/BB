// @vitest-environment jsdom
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { inspectProof } from './run.mjs';
import { installProbe, j29RefPinOverlap, onCanvas } from './j29';

test('proof uses the visible viewport for snapshots and transforms with a 1.5x overscanned SVG', async () => {
  document.body.innerHTML = `
    <div><svg><g data-scene transform="matrix(1 0 0 1 0 0)">
      <image data-layer="photo.image" />
      <g data-layer="components.labels"><text>J29 ?</text></g>
      <g data-layer="measurements.readings"><text>3,651 V</text></g>
    </g></svg></div>`;
  const viewport = document.querySelector('div')!;
  const svg = document.querySelector('svg')!;
  const stage = document.querySelector('[data-scene]')!;
  const reference = document.querySelector('[data-layer="components.labels"] text')!;
  const reading = document.querySelector('[data-layer="measurements.readings"] text')!;
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 80, 400, 300));
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 5, 600, 450));
  vi.spyOn(reference, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 80, 40, 20));
  vi.spyOn(reading, 'getBoundingClientRect').mockReturnValue(new DOMRect(510, 100, 30, 20));
  const visible = { left: 100, top: 80, right: 500, bottom: 380 };
  const probe = installProbe();
  stage.setAttribute('transform', 'matrix(0 1 -1 0 0 0)');
  await Promise.resolve();

  const sample = probe.measure();
  expect(sample.canvas).toEqual(visible);
  expect(onCanvas(sample.canvas, sample.labels[0]!.box)).toBe(true);
  expect(onCanvas(sample.canvas, sample.readings[0]!.box)).toBe(false);
  expect(probe.scenes()).toHaveLength(1);
  const scene = probe.scenes()[0]!;
  expect(scene.canvas).toEqual(visible);
  expect(onCanvas(scene.canvas, scene.reference)).toBe(true);
  expect(onCanvas(scene.canvas, scene.reading)).toBe(false);

  vi.spyOn(svg, 'parentElement', 'get').mockReturnValue(null);
  stage.setAttribute('transform', 'matrix(-1 0 0 -1 0 0)');
  await Promise.resolve();
  expect(probe.measure().canvas).toBeNull();
  expect(probe.scenes()).toHaveLength(1);
});

test('J29 overlap sums both label rows against its own 15 pin numbers in screen pixels', () => {
  const label = (text: string, left: number, right: number, componentId = 'J') => ({
    text,
    componentId,
    box: { left, top: 0, right, bottom: 2 },
  });
  const pins = Array.from({ length: 15 }, (_, n) => label(String(n + 1), n * 10, n * 10 + 4));
  const labels = [
    label('J29 ?', 2, 7),
    label('LONG CONNECTOR VALUE', 9, 14),
    ...pins,
    label('8', 2, 6, 'X'),
  ];
  expect(j29RefPinOverlap(labels)).toBe(12); // 2×2 at pin 1 and 4×2 at pin 2.
  expect(
    j29RefPinOverlap([label('J29 ?', 4, 7), label('LONG CONNECTOR VALUE', 14, 18), ...pins]),
  ).toBe(0);
  expect(j29RefPinOverlap(labels.filter((l) => l.text !== '15'))).toBeNull();
});

let dir: string;
afterEach(() => {
  document.body.replaceChildren();
  delete window.bbCardProof;
  vi.restoreAllMocks();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

test('proof needs both accepted cases in both themes with matching JSON and PNG evidence', () => {
  dir = mkdtempSync(join(tmpdir(), 'bb-proof-report-'));
  const specs = [];
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WjK284AAAAASUVORK5CYII=',
    'base64',
  );
  for (const [scenario, title] of Object.entries({
    j29: 'j29_reading_does_not_overlap_ref_label',
    adjacent: 'adjacent_readings_do_not_overlap',
  })) {
    const tests = [];
    for (const theme of ['light', 'dark']) {
      const stem = scenario + '-' + theme;
      writeFileSync(
        join(dir, stem + '.json'),
        JSON.stringify({
          ok: true,
          test: title,
          theme,
          ...(scenario === 'j29'
            ? { autoRefPinOverlapPx2: theme === 'light' ? 3.25 : 0, refPinOverlapPx2: 12.5 }
            : {}),
        }),
      );
      writeFileSync(join(dir, stem + '.png'), png);
      tests.push({
        projectName: theme,
        status: 'expected',
        expectedStatus: 'passed',
        results: [{ status: 'passed' }],
      });
    }
    specs.push({ title, tests });
  }
  const report = {
    errors: [],
    suites: [{ specs: [], suites: [{ specs }] }],
    stats: { expected: 4, unexpected: 0, skipped: 0, flaky: 0 },
  };
  writeFileSync(join(dir, 'playwright.json'), JSON.stringify(report));
  const scenarios = inspectProof(dir);
  expect(scenarios.every((entry) => entry.ok)).toBe(true);
  expect(scenarios.find((s) => s.stem === 'j29-dark')).toMatchObject({
    ok: true,
    refPinOverlapPx2: 12.5,
    autoRefPinOverlapPx2: 0,
    refPinOverlapNote: 'pärast käsitsi lohistust',
    warnings: [],
  });
  expect(scenarios.find((s) => s.stem === 'j29-light')).toMatchObject({
    ok: true,
    autoRefPinOverlapPx2: 3.25,
    warnings: [expect.stringContaining('autoRefPinOverlapPx2')],
  });
  expect(scenarios.find((s) => s.stem === 'adjacent-dark')).not.toHaveProperty('refPinOverlapPx2');
  rmSync(join(dir, 'j29-dark.png'));
  mkdirSync(join(dir, 'j29-dark.png'));
  const adjacent = specs[1]!.tests[0]!;
  adjacent.status = 'expected';
  adjacent.expectedStatus = 'failed';
  adjacent.results = [{ status: 'failed' }];
  writeFileSync(join(dir, 'playwright.json'), JSON.stringify(report));
  expect(
    inspectProof(dir)
      .filter((entry) => !entry.ok)
      .map((entry) => entry.stem)
      .sort(),
  ).toEqual(['adjacent-light', 'j29-dark']);
});

test('a missing manual measurement stays informational, a missing automatic measurement warns', () => {
  dir = mkdtempSync(join(tmpdir(), 'bb-proof-metrics-'));
  writeFileSync(join(dir, 'j29-light.json'), JSON.stringify({ autoRefPinOverlapPx2: 0 }));
  writeFileSync(join(dir, 'j29-dark.json'), JSON.stringify({ refPinOverlapPx2: 20 }));
  const scenarios = inspectProof(dir);
  expect(scenarios.find((s) => s.stem === 'j29-light')).toMatchObject({
    autoRefPinOverlapPx2: 0,
    refPinOverlapPx2: null,
    warnings: [],
  });
  expect(scenarios.find((s) => s.stem === 'j29-dark')).toMatchObject({
    autoRefPinOverlapPx2: null,
    refPinOverlapPx2: 20,
    warnings: [expect.stringContaining('autoRefPinOverlapPx2')],
  });
});
