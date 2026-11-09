import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, expect, test } from 'vitest';

const scriptPath = fileURLToPath(new URL('./check-file-length.mjs', import.meta.url));
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

test.each([
  [400, 'ok'],
  [401, 'warn'],
  [600, 'warn'],
  [601, 'error'],
] as const)('file length %i is %s', async (lineCount, expected) => {
  expect(existsSync(scriptPath), 'file length gate must exist').toBe(true);
  const gate = (await import(pathToFileURL(scriptPath).href)) as {
    checkLength: (count: number) => 'ok' | 'warn' | 'error';
  };
  expect(gate.checkLength(lineCount)).toBe(expected);
});

function fixtureFile(root: string, relative: string, lines: number) {
  const path = join(root, relative);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, Array.from({ length: lines }, () => '// line').join('\n') + '\n');
}

function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), 'bb-filelength-'));
  temporaryRoots.push(root);
  return root;
}

test('CLI rejects a 601-line source file', () => {
  expect(existsSync(scriptPath), 'file length gate must exist').toBe(true);
  const root = temporaryRoot();
  fixtureFile(root, 'packages/domain/src/long.ts', 601);
  const result = spawnSync(process.execPath, [scriptPath, root], { encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stdout + result.stderr).toContain('long.ts');
});

test('CLI warns at 401 lines and exempts only generated files and bindings', () => {
  expect(existsSync(scriptPath), 'file length gate must exist').toBe(true);
  const root = temporaryRoot();
  fixtureFile(root, 'packages/domain/src/medium.ts', 401);
  fixtureFile(root, 'packages/domain/src/model.gen.ts', 700);
  fixtureFile(root, 'root.gen.ts', 700);
  fixtureFile(root, 'apps/desktop/src/bindings/generated.ts', 700);
  fixtureFile(root, 'node_modules/dependency/large.js', 700);
  const result = spawnSync(process.execPath, [scriptPath, root], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(result.stdout + result.stderr).toContain('medium.ts');
  expect(result.stdout + result.stderr).not.toContain('generated.ts');
  expect(result.stdout + result.stderr).not.toContain('model.gen.ts');
});

test('importing the gate does not execute its CLI', async () => {
  expect(existsSync(scriptPath), 'file length gate must exist').toBe(true);
  const root = temporaryRoot();
  fixtureFile(root, 'packages/domain/src/long.ts', 601);
  expect(() =>
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `await import(${JSON.stringify(pathToFileURL(scriptPath).href)})`,
      ],
      {
        cwd: root,
        encoding: 'utf8',
      },
    ),
  ).not.toThrow();
});
