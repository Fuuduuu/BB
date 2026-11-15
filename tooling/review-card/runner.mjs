import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, openSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

/** @typedef {{path: string, branch: string, head: string}} Worktree */
/** @typedef {{id: string, program: string, args: string[], env?: NodeJS.ProcessEnv}} Step */

/** @param {string} root @returns {Worktree[]} */
export function listWorktrees(root) {
  const data = execFileSync('git', ['worktree', 'list', '--porcelain', '-z'], {
    cwd: root,
    encoding: 'utf8',
  });
  return data
    .split('\0\0')
    .filter(Boolean)
    .map((block) => {
      const fields = block.split('\0');
      const location = fields.find((s) => s.startsWith('worktree '));
      if (!location) throw new Error('Git ei tagastanud tööpuu asukohta.');
      return {
        path: resolve(location.slice('worktree '.length)),
        branch:
          fields
            .find((s) => s.startsWith('branch refs/heads/'))
            ?.slice('branch refs/heads/'.length) ?? '',
        head: fields.find((s) => s.startsWith('HEAD '))?.slice(5) ?? '',
      };
    });
}

/** @param {string} cwd */
export function worktreeChanges(cwd) {
  const result = spawnSync('git', ['--no-optional-locks', 'status', '--porcelain=v1'], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  });
  return result.status === 0 ? result.stdout.trimEnd().split(/\r?\n/).filter(Boolean) : null;
}

/** @param {string} card @param {Worktree[]} trees @param {string} fallback */
export function pickWorktree(card, trees, fallback) {
  const [header = ''] = card.split(/^##\s/m, 1);
  const branch = /\*\*Haru:\*\*\s*`?([\w./-]+)/i.exec(header)?.[1];
  const target = trees.find((tree) =>
    branch ? tree.branch === branch : tree.path === resolve(fallback),
  );
  if (!target)
    throw new Error(`Kaardi haru ${branch ?? ''} tööpuud ei leitud. Anna --worktree <kaust>.`);
  return target;
}

/** @param {{cargoTest:boolean, tauriBuild:boolean, evidence:string}} card @param {string} dir @returns {Step[]} */
export function buildSteps(card, dir, e2eTimeoutMs = 15 * 60_000) {
  if (!Number.isSafeInteger(e2eTimeoutMs) || e2eTimeoutMs <= 0)
    throw new Error('BB_REVIEW_E2E_TIMEOUT_MS peab olema positiivne täisarv millisekundites.');
  /** @type {Step[]} */
  const steps = [
    { id: 'check', program: 'pnpm', args: ['run', 'check'] },
    { id: 'api', program: 'pnpm', args: ['run', 'api:check'] },
    { id: 'format', program: 'pnpm', args: ['run', 'format:check'] },
    {
      id: 'coverage',
      program: 'pnpm',
      args: [
        'run',
        'coverage',
        '--reporter=json',
        `--outputFile=${join(dir, 'unit.json')}`,
        '--coverage.reporter=json-summary',
        '--coverage.reportOnFailure',
        `--coverage.reportsDirectory=${join(dir, 'coverage')}`,
      ],
    },
    {
      id: 'e2e',
      program: 'pnpm',
      args: [
        'run',
        'e2e',
        '--reporter=json',
        `--global-timeout=${e2eTimeoutMs}`,
        '--output',
        join(dir, 'playwright'),
      ],
      env: { CI: '1', PLAYWRIGHT_JSON_OUTPUT_FILE: join(dir, 'e2e.json') },
    },
    { id: 'diff', program: 'git', args: ['diff', '--check'] },
  ];
  if (card.cargoTest) {
    const args = ['test', '--locked', '--manifest-path', 'apps/desktop/src-tauri/Cargo.toml'];
    if (/cargo test[^`\n]*--offline/.test(card.evidence)) args.push('--offline');
    steps.push({ id: 'cargo', program: 'cargo', args });
  }
  if (card.tauriBuild) {
    const args = ['run', 'tauri', 'build'];
    if (/tauri build[^`\n]*--debug/.test(card.evidence)) args.push('--debug');
    steps.push({ id: 'tauri', program: 'pnpm', args });
  }
  return steps;
}

/** @param {string} log */
export function rustCounts(log) {
  const totals = { passed: 0, failed: 0, skipped: 0, total: 0 };
  const matches = [
    ...log.matchAll(/^test result: (?:ok|FAILED)\. (\d+) passed; (\d+) failed; (\d+) ignored;/gm),
  ];
  if (!matches.length) return null;
  for (const [, pass, fail, skip] of matches) {
    totals.passed += Number(pass);
    totals.failed += Number(fail);
    totals.skipped += Number(skip);
  }
  totals.total = totals.passed + totals.failed + totals.skipped;
  return totals;
}

// pnpm run supplies the active package manager's CLI, including the Windows native executable.
// Use its argv directly so spaces and shell metacharacters in report paths remain literal.
/** @returns {[string, ...string[]]} */
function pnpmCommand() {
  const cli = process.env.npm_execpath;
  if (cli && /^pnpm(?:-native)?(?:\.(?:c?js|mjs|exe))?$/i.test(basename(cli)) && existsSync(cli)) {
    return /\.[cm]?js$/i.test(cli) ? [process.execPath, cli] : [cli];
  }
  if (process.platform !== 'win32') return ['pnpm'];
  for (const folder of (process.env.PATH ?? '').split(';').filter(Boolean)) {
    for (const file of [
      'pnpm.exe',
      'node_modules/corepack/dist/pnpm.js',
      'node_modules/pnpm/bin/pnpm.cjs',
    ]) {
      const candidate = join(folder, file);
      if (existsSync(candidate))
        return file.endsWith('.exe') ? [candidate] : [process.execPath, candidate];
    }
  }
  throw new Error('Käivita tööriist käsuga pnpm bb-review-card <kaart>.');
}

/** @param {Step} step @param {string} cwd @param {string} logFile */
export function runStep(step, cwd, logFile) {
  const fd = openSync(logFile, 'w');
  try {
    const [command, ...prefix] = step.program === 'pnpm' ? pnpmCommand() : [step.program];
    const result = spawnSync(command, [...prefix, ...step.args], {
      cwd,
      env: { ...process.env, ...step.env },
      stdio: ['ignore', fd, fd],
      windowsHide: true,
    });
    if (result.error) appendFileSync(logFile, '\n' + result.error.message);
    if (result.signal) appendFileSync(logFile, '\nSignaal: ' + result.signal);
    return result.status ?? 1;
  } catch (error) {
    appendFileSync(logFile, '\n' + String(error));
    return 1;
  } finally {
    closeSync(fd);
  }
}

/** @param {string} path @param {Worktree[]} trees @returns {Worktree} */
export function explicitWorktree(path, trees) {
  const cwd = resolve(path);
  const known = trees.find((tree) =>
    process.platform === 'win32'
      ? tree.path.toLowerCase() === cwd.toLowerCase()
      : tree.path === cwd,
  );
  if (known) return known;
  if (
    !existsSync(join(cwd, 'package.json')) ||
    JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).name !== 'pcb-kaardistaja'
  ) {
    throw new Error('Valitud kaust peab olema BB Git-tööpuu juur.');
  }
  const git = (/** @type {string[]} */ args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  if (resolve(git(['rev-parse', '--show-toplevel'])) !== cwd)
    throw new Error('Vali Git-tööpuu juurkaust.');
  return { path: cwd, branch: git(['branch', '--show-current']), head: git(['rev-parse', 'HEAD']) };
}
