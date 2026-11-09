import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));

function typecheckFixture(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'bb-backend-typecheck-'));
  try {
    for (const filename of [
      'package.json',
      'tsconfig.json',
      'tsconfig.base.json',
      'tsconfig.backend.json',
      'tooling/types/host-timers.d.ts',
    ]) {
      const source = join(sourceRoot, filename);
      if (!existsSync(source)) continue;
      mkdirSync(dirname(join(root, filename)), { recursive: true });
      copyFileSync(source, join(root, filename));
    }
    symlinkSync(join(sourceRoot, 'node_modules'), join(root, 'node_modules'), 'junction');
    for (const [filename, contents] of Object.entries(files)) {
      mkdirSync(dirname(join(root, filename)), { recursive: true });
      writeFileSync(join(root, filename), contents);
    }
    const result =
      process.platform === 'win32'
        ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'pnpm.cmd typecheck'], {
            cwd: root,
            encoding: 'utf8',
          })
        : spawnSync('pnpm', ['typecheck'], { cwd: root, encoding: 'utf8' });
    expect(result.error).toBeUndefined();
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test(
  'root typecheck rejects browser and Node globals in every backend layer',
  { timeout: 60_000 },
  () => {
    const paths = [
      'packages/domain/src/leak.ts',
      'packages/contracts/src/leak.ts',
      'packages/engine/src/leak.ts',
      'packages/engine/src/leak-tsx.tsx',
      'packages/features/demo/contract.ts',
      'packages/features/demo/engine/leak.ts',
    ];
    const result = typecheckFixture(
      Object.fromEntries(
        paths.map((path) => [
          path,
          'export const leak = document.title + process.cwd() + window.location.href;',
        ]),
      ),
    );
    expect(result.status, result.output).toBeGreaterThan(0);
    for (const path of paths) {
      const diagnostics = result.output
        .replaceAll('\\', '/')
        .split('\n')
        .filter((line) => line.includes(path));
      expect(
        diagnostics.join('\n'),
        `Missing diagnostics for ${path}:\n${result.output}`,
      ).toContain("'document'");
      expect(diagnostics.join('\n')).toContain("'window'");
      expect(diagnostics.join('\n')).toContain("'process'");
    }
  },
);

test('host-neutral timers compile while backend tests and frontend keep their host types', () => {
  const result = typecheckFixture({
    'packages/engine/src/timers.ts': `
      export function schedule() {
        const handle: ReturnType<typeof setTimeout> = setTimeout(() => undefined, 10);
        clearTimeout(handle);
        clearTimeout(undefined);
      }
    `,
    'packages/engine/src/host.test.ts': 'export const host = document.title + process.cwd();',
    'packages/features/demo/engine/host.spec.ts': 'export const host = window.location.href;',
    'apps/web/src/view.ts': 'export const title = document.title + window.location.href;',
  });
  expect(result.status, result.output).toBe(0);
});
