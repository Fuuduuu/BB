import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { buildSteps, pickWorktree, rustCounts } from './runner.mjs';

const main = { path: resolve('/bb'), branch: 'main', head: 'aaa' };
const feature = { path: resolve('/worktree'), branch: 'codex/m1-3', head: 'bbb' };

test('the card and the code may live in separate worktrees', () => {
  const card = '# M1-3-8\n\n**Olek:** ülevaatusel · **Haru:** `codex/m1-3` (sama tööpuu)';
  expect(pickWorktree(card, [main, feature], main.path)).toEqual(feature);
  expect(() => pickWorktree(card, [main], main.path)).toThrow('--worktree');
  expect(pickWorktree('# Varasem kaart', [main, feature], main.path)).toEqual(main);
});

test('native steps are added only as required by the evidence', () => {
  const common = buildSteps({ cargoTest: false, tauriBuild: false, evidence: '' }, '/reports');
  expect(common.map((s) => s.id)).toEqual(['check', 'api', 'format', 'coverage', 'e2e', 'diff']);
  expect(common.find((s) => s.id === 'e2e')?.args).toContain('--global-timeout=900000');
  expect(() =>
    buildSteps({ cargoTest: false, tauriBuild: false, evidence: '' }, '/reports', 0),
  ).toThrow();
  const native = buildSteps(
    {
      cargoTest: true,
      tauriBuild: true,
      evidence: '`cargo test --locked --offline`, `pnpm tauri build --debug`',
    },
    '/reports',
  );
  expect(native.find((s) => s.id === 'cargo')?.args).toContain('--offline');
  expect(native.find((s) => s.id === 'tauri')?.args).toContain('--debug');
});

test('Rust totals include separate test binaries and ignored tests only once', () => {
  expect(rustCounts('no tests completed')).toBeNull();
  expect(
    rustCounts(
      'test result: ok. 2 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out\n' +
        'test result: FAILED. 1 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out',
    ),
  ).toEqual({
    passed: 3,
    failed: 1,
    skipped: 1,
    total: 5,
  });
});
