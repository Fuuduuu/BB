import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { browserMetrics, readReport } from '../review-card/metrics.mjs';
import {
  explicitWorktree,
  listWorktrees,
  pickWorktree,
  worktreeChanges,
} from '../review-card/runner.mjs';

const root = resolve(import.meta.dirname, '../..');
const help = 'pnpm proof M1-3-10 [--worktree <BB kaust>]';
const cases = {
  j29: 'j29_reading_does_not_overlap_ref_label',
  adjacent: 'adjacent_readings_do_not_overlap',
};

/** @param {string} file */
function hasPng(file) {
  try {
    return readFileSync(file).subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  } catch {
    return false;
  }
}

/** @param {string} dir */
export function inspectProof(dir) {
  /** @type {import('@playwright/test/reporter').JSONReport | null} */
  const report = readReport(join(dir, 'playwright.json'));
  const suites = report && browserMetrics(report) ? [...report.suites] : [];
  const specs = [];
  for (const suite of suites) {
    suites.push(...(suite.suites ?? []));
    specs.push(...(suite.specs ?? []));
  }
  const results = [];
  for (const [scenario, title] of Object.entries(cases)) {
    for (const theme of ['light', 'dark']) {
      const stem = scenario + '-' + theme;
      const matches = specs
        .filter((s) => s.title === title)
        .flatMap((s) => s.tests)
        .filter((t) => t.projectName === theme);
      const [item] = matches;
      const ran =
        matches.length === 1 &&
        item?.status === 'expected' &&
        item.expectedStatus === 'passed' &&
        item.results.length === 1 &&
        item.results[0]?.status === 'passed';
      const measurements = stem + '.json';
      const screenshot = stem + '.png';
      const evidence = readReport(join(dir, measurements));
      const ok = Boolean(
        ran &&
        evidence?.ok === true &&
        evidence.test === title &&
        evidence.theme === theme &&
        hasPng(join(dir, screenshot)),
      );
      results.push({ stem, title, theme, measurements, screenshot, ok });
    }
  }
  return results;
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      worktree: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(help);
    return 0;
  }
  const [card] = positionals;
  if (positionals.length !== 1 || card !== 'M1-3-10') throw new Error(help);
  const trees = listWorktrees(root);
  const markdown = readFileSync(join(root, 'docs', 'tasks', card + '.md'), 'utf8');
  const target = values.worktree
    ? explicitWorktree(values.worktree, trees)
    : pickWorktree(markdown, trees, root);
  const changesBefore = worktreeChanges(target.path);
  const parent = join(root, 'output', 'playwright', 'proof');
  mkdirSync(parent, { recursive: true });
  const dir = mkdtempSync(join(parent, card + '-'));
  console.log(
    `${card} · ${target.branch || 'detached HEAD'} @ ${target.head.slice(0, 9)}\nTõendid: ${dir}`,
  );
  console.log('Git-i olekuridu enne kontrolli: ' + (changesBefore?.length ?? 'teadmata'));
  let exitCode = 1;
  let applicationSha256;
  let error;
  try {
    const targetRequire = createRequire(join(target.path, 'package.json'));
    targetRequire.resolve('./apps/web/e2e/m1-3-labels.spec.ts');
    const cli = targetRequire.resolve('@playwright/test/cli');
    const { buildProofApp } = await import('./offline-app.mjs');
    applicationSha256 = await buildProofApp(target.path, dir);
    const run = spawnSync(
      process.execPath,
      [
        cli,
        'test',
        '--config',
        join(import.meta.dirname, 'playwright.config.mjs'),
        '--grep',
        '(' + Object.values(cases).join('|') + ')$',
      ],
      {
        cwd: root,
        windowsHide: true,
        stdio: 'inherit',
        env: { ...process.env, BB_PROOF_DIR: dir, BB_PROOF_TARGET: target.path },
      },
    );
    if (run.error) throw run.error;
    exitCode = run.status ?? 1;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
    console.error(error);
  }
  const scenarios = inspectProof(dir);
  const ok = exitCode === 0 && scenarios.every((s) => s.ok);
  const summary = join(dir, 'summary.json');
  writeFileSync(
    summary,
    JSON.stringify(
      { card, ...target, changesBefore, applicationSha256, exitCode, error, scenarios, ok },
      null,
      2,
    ) + '\n',
  );
  console.log(`Tõendatud ${scenarios.filter((s) => s.ok).length}/${scenarios.length} · ${summary}`);
  return ok ? 0 : 1;
}

if (import.meta.main)
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
