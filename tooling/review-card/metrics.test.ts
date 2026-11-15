import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { readMetrics } from './metrics.mjs';

let runDir: string;
beforeEach(() => {
  runDir = mkdtempSync(join(tmpdir(), 'bb-review-metrics-'));
});
afterEach(() => rmSync(runDir, { recursive: true, force: true }));

function report(name: string, value: unknown) {
  const path = join(runDir, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

function unit(statuses: string[]) {
  return {
    success: !statuses.includes('failed'),
    numTotalTests: statuses.length,
    numPassedTests: statuses.filter((s) => s === 'passed').length,
    numFailedTests: statuses.filter((s) => s === 'failed').length,
    testResults: [
      {
        status: statuses.includes('failed') ? 'failed' : 'passed',
        assertionResults: statuses.map((status) => ({ status })),
      },
    ],
  };
}

function e2e(statuses: string[], interrupted = false) {
  const stats = { expected: 0, skipped: 0, unexpected: 0, flaky: 0 };
  const tests = statuses.map((status) => ({
    status,
    expectedStatus: status === 'skipped' ? 'skipped' : 'passed',
    results: [{ status: interrupted ? 'interrupted' : 'passed' }],
  }));
  return {
    stats,
    errors: [] as unknown[],
    suites: [{ specs: [], suites: [{ specs: [{ tests }] }] }],
  };
}

test('keeps failed assertions, todo and retries distinct from passing tests', () => {
  report('unit.json', unit(['passed', 'failed', 'todo', 'skipped']));
  const browser = e2e(['expected', 'unexpected', 'flaky', 'skipped']);
  browser.stats = { expected: 1, unexpected: 1, flaky: 1, skipped: 1 };
  report('e2e.json', browser);
  const result = readMetrics(runDir);
  expect(result.unit).toEqual({ passed: 1, failed: 1, skipped: 2, total: 4 });
  expect(result.e2e).toEqual({ passed: 1, failed: 1, skipped: 1, flaky: 1, total: 4 });
});

test('reads aggregate coverage and preserves zero measured coverage', () => {
  report('coverage/coverage-summary.json', {
    total: {
      lines: { total: 4, covered: 3, pct: 75 },
      branches: { total: 0, covered: 0, pct: 100 },
      functions: { total: 2, covered: 0, pct: 0 },
      statements: { total: 2, covered: 1, pct: 100 },
    },
  });
  expect(readMetrics(runDir).coverage).toEqual({
    lines: 75,
    branches: null,
    functions: 0,
    statements: null,
  });
});

test('does not report incomplete test collection or a failed browser start as a test tally', () => {
  const collected = unit(['passed']);
  collected.success = false;
  collected.testResults.push({ status: 'failed', assertionResults: [] });
  report('unit.json', collected);
  const browser = e2e([]);
  browser.errors.push({ message: 'webServer did not start' });
  report('e2e.json', browser);
  expect(readMetrics(runDir)).toEqual({ unit: null, coverage: null, e2e: null });
});

test('rejects missing, truncated and inconsistent reports', () => {
  expect(readMetrics(runDir)).toEqual({ unit: null, coverage: null, e2e: null });
  writeFileSync(join(runDir, 'unit.json'), '{');
  report('e2e.json', e2e(['expected']));
  expect(readMetrics(runDir)).toEqual({ unit: null, coverage: null, e2e: null });
  report('unit.json', unit(['pending']));
  expect(readMetrics(runDir).unit).toBeNull();
  const interrupted = e2e(['unexpected'], true);
  interrupted.stats.unexpected = 1;
  report('e2e.json', interrupted);
  expect(readMetrics(runDir).e2e).toBeNull();
});
