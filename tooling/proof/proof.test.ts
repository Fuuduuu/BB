import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { inspectProof } from './run.mjs';

let dir: string;
afterEach(() => {
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
      writeFileSync(join(dir, stem + '.json'), JSON.stringify({ ok: true, test: title, theme }));
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
  expect(inspectProof(dir).every((entry) => entry.ok)).toBe(true);
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
