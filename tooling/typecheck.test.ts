import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, test, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });

test('strict typecheck includes both application and package source files', () => {
  const root = mkdtempSync(join(tmpdir(), 'bb-typecheck-'));
  try {
    for (const filename of ['tsconfig.json', 'tsconfig.base.json']) {
      copyFileSync(fileURLToPath(new URL(`../${filename}`, import.meta.url)), join(root, filename));
    }
    const paths = ['apps/web/src/bad.ts', 'packages/engine/src/bad.ts'].map((relative) => {
      const path = join(root, relative);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, 'const values: number[] = []; export const value: number = values[0];\n');
      return path.replaceAll('\\', '/');
    });
    const parsed = ts.getParsedCommandLineOfConfigFile(
      join(root, 'tsconfig.json'),
      {},
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
          throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
        },
      },
    );
    expect(parsed).toBeDefined();
    if (!parsed) throw new Error('tsconfig did not load');
    expect(parsed.fileNames.map((path) => path.replaceAll('\\', '/'))).toEqual(
      expect.arrayContaining(paths),
    );
    const program = ts.createProgram(parsed.fileNames, parsed.options);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    for (const path of paths) {
      expect(
        diagnostics
          .filter((diagnostic) => diagnostic.file?.fileName.replaceAll('\\', '/') === path)
          .map((diagnostic) => diagnostic.code),
      ).toContain(2322);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
