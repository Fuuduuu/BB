import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });

const script = fileURLToPath(new URL('./api-digest.mjs', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/api-digest/', import.meta.url));
let project: string;

function copyFixture(source: string, destination: string) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    if (entry.isDirectory()) {
      copyFixture(from, join(destination, entry.name));
    } else {
      writeFileSync(join(destination, entry.name.replace(/\.txt$/, '')), readFileSync(from));
    }
  }
}

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'bb-api-digest-'));
  copyFixture(fixture, project);
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

function run(...args: string[]) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: project,
    encoding: 'utf8',
    timeout: 15_000,
  });
  if (result.error) throw result.error;
  return { status: result.status, output: result.stdout + result.stderr };
}

function generate() {
  const result = run();
  expect(result.status, result.output).toBe(0);
}

function engineDigest() {
  return readFileSync(join(project, 'docs', 'api', 'engine.md'), 'utf8');
}

test('digest lists exported function signatures without bodies', { timeout: 60_000 }, () => {
  generate();
  const digest = engineDigest();
  expect(digest).toContain('<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->');
  expect(digest).toContain('# @pcbk/engine');
  expect(digest).toContain('packages/engine/src/index.ts');
  expect(digest).toMatch(/function createEngine\(id: string\): EngineModule;/);
  expect(digest).toMatch(/function createProjectService\(path: string\): number;/);
  expect(digest).toMatch(/interface EngineModule\s*\{\s*readonly id: string;\s*\}/);
  expect(digest).toMatch(/type Mode = ['"]edit['"] \| ['"]read['"];/);
  expect(digest).toMatch(/const apiVersion: 1;/);
  expect(digest).toMatch(/class Engine\s*\{/);
  expect(digest).toMatch(/run\(\): string;/);
  expect(digest).not.toMatch(/body-sentinel|bootToken|hiddenHelper/);
  expect(readdirSync(join(project, 'docs', 'api')).sort()).toEqual([
    'engine.md',
    'features-example-contract.md',
    'features-example-engine.md',
    'features-example-ui.md',
  ]);
});

test('digest is sorted and stable across runs', { timeout: 60_000 }, () => {
  generate();
  const first = engineDigest();
  expect([...first.matchAll(/^### `([^`]+)`$/gm)].map((match) => match[1])).toEqual([
    'apiVersion',
    'createEngine',
    'createProjectService',
    'Engine',
    'EngineModule',
    'Mode',
  ]);
  generate();
  expect(engineDigest()).toBe(first);
});

test(
  'check fails when an exported signature changes and passes after regenerate',
  {
    timeout: 30_000,
  },
  () => {
    const missing = run('--check');
    expect(missing.status, missing.output).toBe(1);
    expect(missing.output).toMatch(/docs[\\/]api[\\/]engine\.md/);
    expect(existsSync(join(project, 'docs', 'api'))).toBe(false);

    generate();
    const original = engineDigest();
    const entryPoint = join(project, 'packages', 'engine', 'src', 'index.ts');
    const source = readFileSync(entryPoint, 'utf8');
    writeFileSync(
      entryPoint,
      source.replace('createEngine(id: string)', 'createEngine(id: number)'),
    );

    const stale = run('--check');
    expect(stale.status, stale.output).toBe(1);
    expect(stale.output).toMatch(/docs[\\/]api[\\/]engine\.md/);
    expect(stale.output).toContain('käivita pnpm api');
    expect(engineDigest()).toBe(original);

    generate();
    expect(engineDigest()).toMatch(/function createEngine\(id: number\): EngineModule;/);
    const current = run('--check');
    expect(current.status, current.output).toBe(0);
  },
);

test('check fails for a stale extra file in docs/api', () => {
  generate();
  const extra = join(project, 'docs', 'api', 'retired.md');
  writeFileSync(extra, 'retired API digest\n');

  const stale = run('--check');
  expect(stale.status, stale.output).toBe(1);
  expect(stale.output).toMatch(/docs[\\/]api[\\/]retired\.md/);
  expect(readFileSync(extra, 'utf8')).toBe('retired API digest\n');
});

test('jsdoc first sentence is included', () => {
  generate();
  const digest = engineDigest();
  expect(digest).toMatch(/### `createEngine`\s+Creates an engine\.\s+```ts/);
  expect(digest).not.toContain('This detail belongs in implementation docs.');
});

test('zod schema renders as one line and inferred type as its fields', () => {
  const widgets = join(project, 'packages', 'widgets', 'src');
  mkdirSync(widgets, { recursive: true });
  copyFileSync(join(project, 'widgets.ts'), join(widgets, 'index.ts'));

  const dependencies = join(project, 'node_modules');
  mkdirSync(dependencies);
  const resolveFromDomain = createRequire(
    new URL('../packages/domain/package.json', import.meta.url),
  );
  const zod = dirname(resolveFromDomain.resolve('zod/package.json'));
  symlinkSync(zod, join(dependencies, 'zod'), 'junction');

  generate();
  const digest = readFileSync(join(project, 'docs', 'api', 'widgets.md'), 'utf8');
  expect(digest).toMatch(
    /### `WidgetSchema`\s+```ts\nexport const WidgetSchema: ZodType<Widget>;\n```/,
  );
  expect(digest).toMatch(
    /### `Widget`\s+```ts\nexport type Widget = \{\n +id: string;\n +enabled\?: boolean(?: \| undefined)?;\n\};\n```/,
  );
  expect(digest).toMatch(
    /### `WidgetIdsSchema`\s+```ts\nexport const WidgetIdsSchema: ZodType<string\[\]>;\n```/,
  );
  expect(digest).toMatch(
    /### `WidgetLabelSchema`\s+```ts\nexport const WidgetLabelSchema: ZodType<WidgetLabel>;\n```/,
  );
});
