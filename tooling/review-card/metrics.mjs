import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** @param {string} path */
function readReport(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} report */
function unitMetrics(report) {
  if (!record(report) || !Array.isArray(report.testResults) || typeof report.success !== 'boolean')
    return null;

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const file of report.testResults) {
    if (!record(file) || !Array.isArray(file.assertionResults)) return null;
    const failedBefore = failed;
    for (const test of file.assertionResults) {
      if (test?.status === 'passed') passed++;
      else if (test?.status === 'failed') failed++;
      else if (test?.status === 'skipped' || test?.status === 'todo') skipped++;
      else return null; // Vitest also reports pending assertions when interrupted.
    }
    // A collection or setup failure can produce zero assertions for an entire file.
    if (file.status !== (failed > failedBefore ? 'failed' : 'passed')) return null;
  }
  const total = passed + failed + skipped;
  if (
    passed !== report.numPassedTests ||
    failed !== report.numFailedTests ||
    total !== report.numTotalTests ||
    report.success !== (failed === 0)
  )
    return null;
  return { passed, failed, skipped, total };
}

/** @param {unknown} value @returns {value is number} */
function count(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** @param {unknown} metric */
function coveragePercent(metric) {
  if (!record(metric)) return null;
  const { total, covered, pct } = metric;
  if (!count(total) || !count(covered) || total === 0 || covered > total) return null;
  // The Istanbul JSON summary truncates percentages to two decimal places.
  const thousandthsOfPercent = (100_000 * covered) / total;
  return pct === Math.floor(thousandthsOfPercent / 10) / 100 ? pct : null;
}

/** @param {unknown} report */
function coverageMetrics(report) {
  if (!record(report) || !record(report.total)) return null;
  const { lines, branches, functions, statements } = report.total;
  return {
    lines: coveragePercent(lines),
    branches: coveragePercent(branches),
    functions: coveragePercent(functions),
    statements: coveragePercent(statements),
  };
}

/** @param {unknown} report */
function browserMetrics(report) {
  if (!record(report) || !Array.isArray(report.suites) || !Array.isArray(report.errors))
    return null;
  if (report.errors.length || !record(report.stats)) return null;
  const { expected: passed, unexpected: failed, skipped, flaky } = report.stats;
  if (!count(passed) || !count(failed) || !count(skipped) || !count(flaky)) return null;

  const suites = [...report.suites];
  const observed = new Map([
    ['expected', 0],
    ['unexpected', 0],
    ['skipped', 0],
    ['flaky', 0],
  ]);
  for (const suite of suites) {
    if (!record(suite) || !Array.isArray(suite.specs)) return null;
    if (suite.suites !== undefined) {
      if (!Array.isArray(suite.suites)) return null;
      suites.push(...suite.suites);
    }
    for (const spec of suite.specs) {
      if (!Array.isArray(spec?.tests)) return null;
      for (const test of spec.tests) {
        if (!Array.isArray(test?.results)) return null;
        if (test.results.some((/** @type {{status?: string}} */ r) => r?.status === 'interrupted'))
          return null;
        if (!test.results.length && test.expectedStatus !== 'skipped') return null;
        const previous = observed.get(test?.status);
        if (previous === undefined) return null;
        observed.set(test.status, previous + 1);
      }
    }
  }
  for (const [outcome, value] of observed) {
    if (report.stats[outcome] !== value) return null;
  }
  return { passed, failed, skipped, flaky, total: passed + failed + skipped + flaky };
}

/** @param {string} runDir */
export function readMetrics(runDir) {
  return {
    unit: unitMetrics(readReport(join(runDir, 'unit.json'))),
    coverage: coverageMetrics(readReport(join(runDir, 'coverage', 'coverage-summary.json'))),
    e2e: browserMetrics(readReport(join(runDir, 'e2e.json'))),
  };
}
