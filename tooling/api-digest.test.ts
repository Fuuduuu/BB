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

function domainFixture() {
  const domain = join(project, 'packages', 'domain');
  mkdirSync(join(domain, 'src', 'model'), { recursive: true });
  mkdirSync(join(domain, 'src', 'measure'), { recursive: true });
  writeFileSync(
    join(domain, 'package.json'),
    JSON.stringify({
      exports: {
        '.': './src/index.ts',
        './model': './src/model/index.ts',
        './measure/reading': './src/measure/reading.ts',
      },
    }),
  );
  writeFileSync(join(domain, 'src', 'index.ts'), 'export const rootOnly = true;\n');
  writeFileSync(join(domain, 'src', 'model', 'index.ts'), 'export type Board = { id: string };\n');
  writeFileSync(
    join(domain, 'src', 'measure', 'reading.ts'),
    'export function read(value: number): string { return String(value); }\n',
  );
  return domain;
}

function digests() {
  const output = join(project, 'docs', 'api');
  return Object.fromEntries(
    readdirSync(output)
      .sort()
      .map((file) => [file, readFileSync(join(output, file), 'utf8')]),
  );
}

test('ui barrel generates separate directory digests with the unchanged public import name', () => {
  const ui = join(project, 'packages', 'ui', 'src');
  for (const name of ['kit', 'canvas']) mkdirSync(join(ui, name), { recursive: true });
  writeFileSync(join(ui, 'index.ts'), "export * from './kit';\nexport * from './canvas';\n");
  writeFileSync(join(ui, 'kit', 'index.ts'), "export { button } from './button';\n");
  writeFileSync(join(ui, 'kit', 'button.ts'), 'export const button = true;\n');
  writeFileSync(join(ui, 'canvas', 'index.ts'), 'export type Canvas = { zoom: number };\n');
  generate();
  const files = digests();
  expect(Object.keys(files).filter((file) => file.startsWith('ui'))).toEqual([
    'ui-canvas.md',
    'ui-kit.md',
    'ui.md',
  ]);
  expect(files['ui.md']).toContain('[canvas](ui-canvas.md)');
  expect(files['ui.md']).toContain('[kit](ui-kit.md)');
  expect(files['ui.md']).not.toContain('```');
  expect(files['ui-kit.md']).toContain('export const button: true;');
  expect(files['ui-canvas.md']).toMatch(/export type Canvas = \{\s*zoom: number;/);
  for (const name of ['canvas', 'kit']) {
    expect(files[`ui-${name}.md`]).toContain('# @pcbk/ui\n');
    expect(files[`ui-${name}.md`]).toContain(`packages/ui/src/${name}/index.ts`);
    expect(files[`ui-${name}.md`]).not.toContain(`@pcbk/ui/${name}`);
  }
  generate();
  expect(digests()).toEqual(files);
  writeFileSync(join(ui, 'canvas', 'index.ts'), 'export type Canvas = { zoom: string };\n');
  const stale = run('--check');
  expect(stale.status, stale.output).toBe(1);
  expect(stale.output).toContain('Erineb: docs/api/ui-canvas.md');
  expect(digests()).toEqual(files);
  generate();
  expect(digests()['ui-canvas.md']).toMatch(/zoom: string;/);
  expect(run('--check').status).toBe(0);
});

test('api_digest_writes_one_file_per_domain_subpath', () => {
  domainFixture();
  generate();
  const files = digests();
  expect(Object.keys(files).filter((file) => file.startsWith('domain'))).toEqual([
    'domain-measure-reading.md',
    'domain-model.md',
    'domain.md',
  ]);
  expect(files['domain-model.md']).toContain('packages/domain/src/model/index.ts');
  expect(files['domain-model.md']).toMatch(/export type Board = \{\s*id: string;\s*\};/);
  expect(files['domain-measure-reading.md']).toContain('packages/domain/src/measure/reading.ts');
  expect(files['domain-measure-reading.md']).toContain('function read(value: number): string;');
  expect(files['domain.md']).toContain('[model](domain-model.md)');
  expect(files['domain.md']).toContain('[measure/reading](domain-measure-reading.md)');
  expect(files['domain.md']).not.toMatch(/```|rootOnly|export /);
  expect(Object.values(files).join('\n')).not.toContain('rootOnly');
  for (const [file, contents] of Object.entries(files)) {
    if (file.startsWith('domain')) expect(contents.split('\n').length - 1).toBeLessThan(400);
  }
  generate();
  expect(digests()).toEqual(files);
});

test('domain check reports every stale subpath without writing and update removes obsolete files', () => {
  const domain = domainFixture();
  generate();
  const obsolete = join(project, 'docs', 'api', 'domain-retired.md');
  writeFileSync(obsolete, 'obsolete domain API\n');
  const before = digests();
  writeFileSync(
    join(domain, 'package.json'),
    JSON.stringify({
      exports: {
        '.': './src/index.ts',
        './model': './src/model/index.ts',
        './ids': './src/ids.ts',
      },
    }),
  );
  writeFileSync(join(domain, 'src', 'model', 'index.ts'), 'export type Board = { id: number };\n');
  writeFileSync(join(domain, 'src', 'ids.ts'), 'export type BoardId = string;\n');

  const stale = run('--check');
  expect(stale.status, stale.output).toBe(1);
  for (const file of [
    'domain.md',
    'domain-model.md',
    'domain-measure-reading.md',
    'domain-ids.md',
    'domain-retired.md',
  ]) {
    expect(stale.output).toContain(`Erineb: docs/api/${file}`);
  }
  expect(digests()).toEqual(before);

  generate();
  expect(existsSync(obsolete)).toBe(false);
  const updated = digests();
  expect(updated['domain-measure-reading.md']).toBeUndefined();
  expect(updated['domain-ids.md']).toContain('export type BoardId = string;');
  expect(updated['domain-model.md']).toMatch(/id: number;/);
  expect(updated['domain.md']).not.toContain('measure/reading');
  expect(updated['domain.md']).toContain('[ids](domain-ids.md)');
  const current = run('--check');
  expect(current.status, current.output).toBe(0);
});

test('api_digest_splits_reexport_only_index_per_source_file', () => {
  const domain = domainFixture();
  generate();
  const manifest = join(domain, 'package.json');
  const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
  for (const name of ['components', 'measure', 'mixed', 'named']) {
    pkg.exports[`./${name}`] = `./src/${name}/index.ts`;
    mkdirSync(join(domain, 'src', name), { recursive: true });
  }
  writeFileSync(manifest, JSON.stringify(pkg));
  const sources = {
    'model/index.ts': "export * from './board';\nexport * from './record';\n",
    'model/board.ts': 'export type Board = { id: string };\n',
    'model/record.ts': 'export type RecordId = number;\n',
    'components/index.ts': "export * from './pins';\n",
    'components/pins.ts': 'export const pinCount = 2;\n',
    'measure/index.ts': "export * from './reading';\n",
    'mixed/index.ts': "export * from './part';\nexport const local = true;\n",
    'mixed/part.ts': 'export type Mixed = string;\n',
    'named/index.ts': "export { Source as Alias } from './part';\n",
    'named/part.ts': 'export type Source = number;\n',
  };
  for (const [file, source] of Object.entries(sources)) {
    writeFileSync(join(domain, 'src', file), source);
  }
  const before = digests();
  const stale = run('--check');
  expect(stale.status, stale.output).toBe(1);
  expect(stale.output).toContain('Erineb: docs/api/domain-model.md');
  expect(stale.output).toContain('Erineb: docs/api/domain-model-board.md');
  expect(digests()).toEqual(before);
  generate();
  const files = digests();
  expect(Object.keys(files).filter((file) => file.startsWith('domain'))).toEqual([
    'domain-components-pins.md',
    'domain-measure-reading.md',
    'domain-mixed.md',
    'domain-model-board.md',
    'domain-model-record.md',
    'domain-named.md',
    'domain.md',
  ]);
  expect(files['domain-model-board.md']).toMatch(/export type Board = \{\s*id: string;/);
  expect(files['domain-model-board.md']).toContain('# @pcbk/domain/model\n');
  expect(files['domain-model-board.md']).not.toContain('@pcbk/domain/model/board');
  expect(files['domain-components-pins.md']).toContain('export const pinCount: 2;');
  expect(files['domain-mixed.md']).toContain('export const local: true;');
  expect(files['domain-named.md']).toContain('export type Alias = number;');
  expect(files['domain-measure-reading.md']).toContain('function read(value: number): string;');
  expect(files['domain-measure-reading.md']).toContain('# @pcbk/domain/measure/reading\n');
  expect(files['domain.md']).toMatch(/### `\.\/model`\s+- \[board\]\(domain-model-board.md\)/);
  expect(files['domain.md']).toContain('[record](domain-model-record.md)');
  expect(files['domain.md']).toContain('[reading](domain-measure-reading.md)');
  expect(files['domain.md']).toContain('[measure/reading](domain-measure-reading.md)');
  writeFileSync(join(domain, 'src', 'model', 'board.ts'), 'export type Board = { id: number };\n');
  const changed = run('--check');
  expect(changed.status, changed.output).toBe(1);
  expect(changed.output).toContain('Erineb: docs/api/domain-model-board.md');
  expect(digests()).toEqual(files);
  generate();
  expect(digests()['domain-model-board.md']).toMatch(/id: number;/);
  const current = run('--check');
  expect(current.status, current.output).toBe(0);
});

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
