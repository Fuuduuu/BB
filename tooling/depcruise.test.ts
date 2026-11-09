import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cruise, type IConfiguration } from 'dependency-cruiser';
import { expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const configPath = fileURLToPath(new URL('../.dependency-cruiser.cjs', import.meta.url));
const fixturePath = fileURLToPath(new URL('./fixtures/depcruise', import.meta.url));

async function cruiseFixture() {
  expect(existsSync(configPath), 'dependency rules must exist').toBe(true);
  const configuration = require(configPath) as IConfiguration;
  const report = await cruise(['packages', 'apps'], {
    ...configuration.options,
    baseDir: fixturePath,
    tsConfig: { fileName: `${fixturePath}/tsconfig.json` },
    validate: true,
    ruleSet: configuration,
    outputType: 'json',
  });
  expect(typeof report.output).toBe('string');
  return JSON.parse(report.output as string) as {
    modules: { source: string; dependencies: { resolved: string }[] }[];
    summary: { violations: { rule: { name: string }; from: string; to: string }[] };
  };
}

test('feature UI importing engine is a violation', async () => {
  const result = await cruiseFixture();
  expect(result.summary.violations.map((violation) => violation.rule.name)).toContain(
    'feature-ui-not-engine',
  );
});

test('feature UI cannot bypass the boundary through a workspace alias', async () => {
  const result = await cruiseFixture();
  expect(
    result.summary.violations.some(
      (violation) =>
        violation.rule.name === 'feature-ui-not-engine' && violation.from.endsWith('/bad-alias.ts'),
    ),
  ).toBe(true);
});

test('feature UI cannot import the features registry', async () => {
  const result = await cruiseFixture();
  const violations = result.summary.violations.filter(
    (violation) => violation.rule.name === 'features-registry-apps-only',
  );
  expect(violations.map(({ from, to }) => [from, to])).toEqual(
    expect.arrayContaining([
      ['packages/features/demo/ui/bad-registry.ts', 'packages/features/engine.ts'],
      ['packages/features/demo/ui/bad-registry.ts', 'packages/features/ui.ts'],
    ]),
  );
  const app = result.modules.find(({ source }) => source === 'apps/demo/src/good.ts');
  expect(app?.dependencies.map(({ resolved }) => resolved)).toEqual(
    expect.arrayContaining(['packages/features/engine.ts', 'packages/features/ui.ts']),
  );
  expect(violations.some(({ from }) => from.startsWith('apps/'))).toBe(false);
});

test('all eight layer boundaries reject forbidden imports', async () => {
  const result = await cruiseFixture();
  expect([...new Set(result.summary.violations.map((violation) => violation.rule.name))]).toEqual(
    expect.arrayContaining([
      'domain-pure',
      'contracts-no-impl',
      'engine-no-ui',
      'ui-not-engine',
      'feature-ui-not-engine',
      'feature-engine-no-ui',
      'client-no-engine',
      'adapters-no-ui',
    ]),
  );
});

test.each([
  ['contracts-domain-types-only', '/contracts/src/bad-runtime-model.ts'],
  ['ui-domain-types-or-geometry', '/ui/src/bad-domain-runtime.ts'],
  ['feature-private-api', '/features/demo/ui/bad-private.ts'],
  ['feature-private-api', '/features/demo/engine/bad-private.ts'],
  ['shared-code-no-node', '/engine/src/bad-host.ts'],
  ['domain-pure', '/domain/src/bad-third-party.ts'],
  ['engine-public-api-only', '/features/demo/engine/bad-engine-internal.ts'],
  ['engine-public-api-only', '/adapters/src/bad-engine-internal.ts'],
  ['ui-domain-types-or-geometry', '/ui/src/bad-footprints.ts'],
])('%s blocks %s', async (rule, from) => {
  const result = await cruiseFixture();
  expect(
    result.summary.violations.some(
      (violation) => violation.rule.name === rule && violation.from.endsWith(from),
    ),
  ).toBe(true);
});

test('allowed public APIs, geometry, type imports and nanoid stay valid', async () => {
  const result = await cruiseFixture();
  expect(
    result.summary.violations.filter((violation) => violation.from.endsWith('/good.ts')),
  ).toEqual([]);
});

test('the dependency CLI fails for forbidden imports', () => {
  const dependencyRoot = new URL('../node_modules/dependency-cruiser/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('package.json', dependencyRoot), 'utf8')) as {
    bin: { depcruise: string };
  };
  const cli = fileURLToPath(new URL(manifest.bin.depcruise, dependencyRoot));
  const result = spawnSync(
    process.execPath,
    [
      cli,
      '--config',
      configPath,
      '--ts-config',
      'tsconfig.json',
      '--output-type',
      'err',
      'packages',
    ],
    { cwd: fixturePath, encoding: 'utf8' },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBeGreaterThan(0);
  expect(result.stdout + result.stderr).toContain('feature-ui-not-engine');
  expect(result.stdout + result.stderr).toContain('bad-alias.ts');
});
