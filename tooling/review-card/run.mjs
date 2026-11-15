import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { parseArgs } from 'node:util';
import { findMissingTests, parseCard } from './card.mjs';
import { readMetrics } from './metrics.mjs';
import {
  buildSteps,
  explicitWorktree,
  listWorktrees,
  pickWorktree,
  runStep,
  rustCounts,
  worktreeChanges,
} from './runner.mjs';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const help =
  'pnpm bb-review-card <kaardi-ID> [--worktree <BB kaust>] [--plan]\n' +
  'Kaart loetakse põhikaustast. Vaikimisi kasutatakse kaardi haru tööpuud. --plan kontrollib ainult kaarti ja testinimesid.';

/** @param {{total:number, passed:number, failed:number, skipped:number, flaky?:number} | null} value */
function counts(value) {
  if (!value) return 'teadmata';
  return (
    `${value.passed}/${value.total} läbis, ${value.failed} ebaõnnestus, ${value.skipped} vahele jäetud` +
    (value.flaky ? `, ${value.flaky} läbis kordusel` : '')
  );
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      worktree: { type: 'string' },
      plan: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(help);
    return 0;
  }
  const id = positionals[0] ?? '';
  if (positionals.length !== 1 || !/^[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+$/.test(id)) {
    throw new Error(help);
  }
  const cardPath = join(root, 'docs', 'tasks', id + '.md');
  const markdown = readFileSync(cardPath, 'utf8');
  const card = parseCard(markdown);
  const trees = listWorktrees(root);
  const target = values.worktree
    ? explicitWorktree(values.worktree, trees)
    : pickWorktree(markdown, trees, root);
  const changesBefore = worktreeChanges(target.path);
  const missing = findMissingTests(target.path, card.names, card.kinds);
  console.log(
    `${id} · rada ${card.lane ?? 'määramata'} · ${target.branch || 'detached HEAD'} @ ${target.head.slice(0, 9)}\nTööpuu: ${target.path}`,
  );
  console.log('Git-i olekuridu enne kontrolli: ' + (changesBefore?.length ?? 'teadmata'));
  console.log(
    `Kaardi testinimed: ${card.names.length - missing.length}/${card.names.length} leitud` +
      (missing.length ? '\nPuuduvad: ' + missing.join(', ') : ''),
  );
  console.log(
    `Cargo test: ${card.cargoTest ? 'jah' : 'ei'} · Tauri build: ${card.tauriBuild ? 'jah' : 'ei'}`,
  );
  for (const warning of card.warnings) console.log('Kaart vajab tähelepanu: ' + warning);
  const completeCard = !missing.length && !card.warnings.length;
  if (values.plan) {
    console.log('Ainult plaan. Käske ei käivitatud.');
    return completeCard ? 0 : 1;
  }

  const parent = join(root, 'output', 'review-card');
  mkdirSync(parent, { recursive: true });
  const dir = mkdtempSync(join(parent, id + '-'));
  console.log('Logid: ' + dir);
  const timeout = process.env.BB_REVIEW_E2E_TIMEOUT_MS;
  const steps = buildSteps(card, dir, timeout === undefined ? undefined : Number(timeout));
  const checks = [];
  for (const step of steps) {
    const log = join(dir, step.id + '.log');
    console.log(
      `Käivitan ${step.program} ${step.args.slice(0, step.program === 'pnpm' ? 2 : 1).join(' ')} …`,
    );
    const exitCode = runStep(step, target.path, log);
    checks.push({ id: step.id, command: [step.program, ...step.args], exitCode, log });
    if (exitCode !== 0) console.log(`  VIGA (${exitCode}): ${log}`);
  }
  const metrics = readMetrics(dir);
  const rust = card.cargoTest ? rustCounts(readFileSync(join(dir, 'cargo.log'), 'utf8')) : null;
  const coverage = metrics.coverage;
  const hasCoverage = coverage && Object.values(coverage).every((v) => v !== null);
  const ok = Boolean(
    completeCard &&
    checks.every((c) => c.exitCode === 0) &&
    metrics.unit &&
    metrics.unit.passed > 0 &&
    !metrics.unit.failed &&
    hasCoverage &&
    metrics.e2e &&
    metrics.e2e.passed + metrics.e2e.flaky > 0 &&
    !metrics.e2e.failed &&
    (!card.cargoTest || (rust && rust.passed > 0 && !rust.failed)),
  );
  const result = {
    card: id,
    cardPath,
    ...target,
    changesBefore,
    lane: card.lane,
    requiredTests: card.names,
    missing,
    warnings: card.warnings,
    cargoTest: card.cargoTest,
    tauriBuild: card.tauriBuild,
    checks,
    ...metrics,
    rust,
    ok,
  };
  writeFileSync(join(dir, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(
    '\n' +
      (ok
        ? 'Kaardi ühised automaatsed kontrollid läbisid.'
        : 'Kaardi ühistes kontrollides on viga või tõend puudub.'),
  );
  console.log(checks.map((c) => `${c.id}: ${c.exitCode === 0 ? 'OK' : 'VIGA'}`).join(' · '));
  console.log('Vitest: ' + counts(metrics.unit) + '\nE2E: ' + counts(metrics.e2e));
  if (card.cargoTest) console.log('Rust: ' + counts(rust));
  const percent = (/** @type {number | null} */ value) =>
    value === null ? 'teadmata' : value + '%';
  console.log(
    'Katvus: ' +
      (coverage
        ? `read ${percent(coverage.lines)}, harud ${percent(coverage.branches)}, funktsioonid ${percent(coverage.functions)}, laused ${percent(coverage.statements)}`
        : 'teadmata'),
  );
  console.log('Kokkuvõte: ' + join(dir, 'summary.json'));
  return ok ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
