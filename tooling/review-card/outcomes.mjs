import { join, relative, resolve } from 'node:path';
import { browserMetrics, readReport, unitMetrics } from './metrics.mjs';
import { readRustOutcomes } from './rust-outcomes.mjs';

/** @typedef {'unit'|'e2e'|'rust'|'type'} Kind */
/** @typedef {'passed'|'failed'|'skipped'|'flaky'|'typechecked'|'not-run'|'unknown'} Status */
/** @typedef {import('./card.mjs').TestDeclaration} Declaration */
/** @typedef {{kind:Kind,file:string|null,title:string,status:Status,fullName?:string,project?:string,line?:number,expectedFailure?:boolean,reportedStatus?:Status}} Match */
/** @typedef {{name:string,kind:Kind|'any',status:Status,matches:Match[]}} Outcome */

/** @param {string} root @param {string} path */
function reportPath(root, path) {
  return relative(root, resolve(root, path)).replaceAll('\\', '/');
}

/** @param {string} dir @param {string} root @returns {Match[]|null} */
function unitRows(dir, root) {
  const report = readReport(join(dir, 'unit.json'));
  if (!unitMetrics(report)) return null;
  /** @type {Match[]} */
  const rows = [];
  for (const suite of report.testResults) {
    if (typeof suite.name !== 'string') return null;
    const file = reportPath(root, suite.name);
    for (const assertion of suite.assertionResults) {
      if (typeof assertion.title !== 'string') return null;
      rows.push({
        kind: 'unit',
        file,
        title: assertion.title,
        fullName: assertion.fullName,
        line: assertion.location?.line,
        status: assertion.status === 'todo' ? 'skipped' : assertion.status,
      });
    }
  }
  return rows;
}

/** @param {{status:string,expectedStatus:string,results:{status:string}[]}} test @returns {Status} */
function browserStatus(test) {
  if (test.status === 'skipped') return 'skipped';
  if (test.status === 'unexpected') return 'failed';
  const last = test.results.at(-1)?.status;
  // Playwright also calls an explicitly expected assertion failure "expected".
  if (last === 'failed' || last === 'timedOut') return 'failed';
  if (last !== 'passed' || test.expectedStatus !== 'passed') return 'unknown';
  return test.status === 'flaky' ? 'flaky' : 'passed';
}

/** @param {string} dir @param {string} root @returns {Match[]|null} */
function browserRows(dir, root) {
  const report = readReport(join(dir, 'e2e.json'));
  if (!browserMetrics(report)) return null;
  const testRoot = report.config?.rootDir ?? join(root, 'apps/web/e2e');
  if (typeof testRoot !== 'string') return null;
  /** @type {Match[]} */
  const rows = [];
  const suites = [...report.suites];
  for (const suite of suites) {
    suites.push(...(suite.suites ?? []));
    for (const spec of suite.specs) {
      if (typeof spec.title !== 'string' || typeof spec.file !== 'string') return null;
      const file = reportPath(root, resolve(root, testRoot, spec.file));
      for (const test of spec.tests) {
        rows.push({
          kind: 'e2e',
          file,
          title: spec.title,
          line: spec.line,
          project: test.projectName,
          status: browserStatus(test),
        });
      }
    }
  }
  return rows;
}

// Substitute placeholders in the declared .each/.for format, escaping all literal title text.
/** @param {string} template */
function casePattern(template) {
  const tokens = template.split(/(%%|%[sdifjoO#$]|\$[\w.]+)/g);
  return new RegExp(
    '^' +
      tokens
        .map((token, i) => {
          if (i % 2) return token === '%%' ? '%' : '[\\s\\S]*';
          return token.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
        })
        .join('') +
      '$',
  );
}

/** @param {Match[]} rows @param {Declaration} declaration @returns {Match[]} */
function matchesDeclaration(rows, declaration) {
  const { file, kind, title, parameterized, line, endLine } = declaration;
  const pattern = parameterized ? casePattern(title) : undefined;
  const matches = rows.filter((row) => {
    if (kind === 'rust') return row.title === title || row.fullName === title;
    if (file !== row.file) return false;
    if (row.line && line && (row.line < line || row.line > (endLine ?? line))) return false;
    return pattern ? pattern.test(row.title) : row.title === title;
  });
  if (kind !== 'unit' || !declaration.expectedFailure) return matches;
  // Vitest reports .fails as passed when the assertion actually failed.
  return matches.map((row) => ({
    ...row,
    expectedFailure: true,
    reportedStatus: row.status,
    status: row.status === 'passed' ? 'failed' : row.status,
  }));
}

/** @param {Status[]} statuses @returns {Status} */
function combinedStatus(statuses) {
  for (const status of /** @type {const} */ ([
    'failed',
    'unknown',
    'not-run',
    'skipped',
    'flaky',
    'passed',
    'typechecked',
  ])) {
    if (statuses.includes(status)) return status;
  }
  return 'not-run';
}

/**
 * Read executable evidence for each named requirement in this review only. Type declarations
 * have no test-runner rows and are reported separately if the enclosing check actually passed.
 * @param {string} dir
 * @param {{names:string[],kinds:Record<string,('unit'|'e2e'|'rust'|'any')[]>,cargoTest:boolean}} card
 * @param {Declaration[]} declarations
 * @param {{root:string,typecheckPassed?:boolean,cargoPassed?:boolean}} options
 * @returns {Outcome[]}
 */
export function readCardOutcomes(dir, card, declarations, { root, typecheckPassed, cargoPassed }) {
  const rust = card.cargoTest ? readRustOutcomes(dir) : [];
  /** @type {Record<Kind,Match[]|null>} */
  const rows = {
    unit: unitRows(dir, root),
    e2e: browserRows(dir, root),
    type: [],
    rust: rust?.map((r) => ({ ...r, kind: 'rust', file: null })) ?? null,
  };
  /** @type {Outcome[]} */
  const outcomes = [];
  for (const name of card.names) {
    const sources = declarations.filter((d) => d.name === name);
    const requirements = card.kinds[name] ?? ['any'];
    /** @type {Set<Kind|'any'>} */
    const kinds = new Set();
    for (const requirement of requirements) {
      if (requirement === 'any') {
        for (const source of sources) kinds.add(source.kind);
        // Dynamic names can still have an exact entry in a reporter.
        if (!sources.length) {
          for (const kind of /** @type {const} */ (['unit', 'e2e', 'rust'])) {
            if (
              rows[kind]?.some((r) => r.title === name || (kind === 'rust' && r.fullName === name))
            )
              kinds.add(kind);
          }
        }
      } else if (requirement === 'unit' && sources.some((d) => d.kind === 'type')) {
        kinds.add('type');
        if (sources.some((d) => d.kind === 'unit')) kinds.add('unit');
      } else kinds.add(requirement);
    }
    if (!kinds.size) kinds.add('any');
    for (const kind of kinds) {
      const declared = sources.filter((d) => d.kind === kind);
      if (kind === 'type') {
        const status = typecheckPassed ? 'typechecked' : 'unknown';
        outcomes.push({
          name,
          kind,
          status,
          matches: declared.map((d) => ({ kind, file: d.file, title: d.title, status })),
        });
        continue;
      }
      const report = kind === 'any' ? null : rows[kind];
      const missingStatus =
        (kind === 'any' ? Object.values(rows).some((r) => r === null) : !report) ||
        (kind === 'rust' && cargoPassed === false)
          ? 'unknown'
          : 'not-run';
      /** @type {Set<Match>} */
      const matches = new Set();
      /** @type {Status[]} */
      const statuses = [];
      const groups = declared.length
        ? declared.map((d) => matchesDeclaration(report ?? [], d))
        : [
            (report ?? []).filter(
              (r) => r.title === name || (kind === 'rust' && r.fullName === name),
            ),
          ];
      for (const group of groups) {
        if (!group.length) statuses.push(missingStatus);
        for (const row of group) {
          // One reported instance cannot prove two different source declarations.
          if (matches.has(row)) statuses.push('unknown');
          matches.add(row);
          statuses.push(row.status);
        }
      }
      outcomes.push({ name, kind, status: combinedStatus(statuses), matches: [...matches] });
    }
  }
  return outcomes;
}
