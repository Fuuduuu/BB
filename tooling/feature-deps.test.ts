import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cruise, type IConfiguration } from 'dependency-cruiser';
import { expect, test, vi } from 'vitest';
import { engineFeatures } from '../packages/features/engine';

vi.setConfig({ testTimeout: 60_000 });

type FeatureDependencies = { id: string; dependsOn?: readonly string[] };
type FeatureImport = { from: string; to: string; sourceId: string; targetId: string };

const require = createRequire(import.meta.url);
const configuration = require('../.dependency-cruiser.cjs') as IConfiguration;
const workspace = fileURLToPath(new URL('../', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/feature-deps/', import.meta.url));
const featurePath = /^packages\/features\/([^/]+)\//;
const testPath = /(?:\.(?:test|spec)(?:-d)?\.[cm]?[jt]sx?$|\/(?:__tests__|tests)\/)/;

async function featureImports(baseDir: string, tsConfigFile: string): Promise<FeatureImport[]> {
  const { output } = await cruise(['packages/features'], {
    ...configuration.options,
    baseDir,
    tsConfig: { fileName: join(baseDir, tsConfigFile) },
  });
  if (typeof output === 'string') throw new Error('Expected a dependency-cruiser graph');

  const imports: FeatureImport[] = [];
  for (const { source, dependencies } of output.modules) {
    const sourceId = featurePath.exec(source)?.[1];
    if (!sourceId || testPath.test(source)) continue;
    for (const { resolved, couldNotResolve } of dependencies) {
      const targetId = featurePath.exec(resolved)?.[1];
      if (!couldNotResolve && targetId && targetId !== sourceId) {
        imports.push({ from: source, to: resolved, sourceId, targetId });
      }
    }
  }
  return imports;
}

function findUndeclaredImports(
  imports: readonly FeatureImport[],
  features: readonly FeatureDependencies[],
): string[] {
  const declared = new Map(features.map(({ id, dependsOn }) => [id, dependsOn ?? []]));
  return imports
    .filter(({ sourceId, targetId }) => !declared.get(sourceId)?.includes(targetId))
    .map(
      ({ from, to, sourceId, targetId }) => `${from} → ${to} (${sourceId} dependsOn ${targetId})`,
    );
}

test('feature_import_requires_declared_dependency', async () => {
  const imports = await featureImports(fixture, 'tsconfig.json');
  const features = [{ id: 'demo' }, { id: 'other' }];
  expect(findUndeclaredImports(imports, features)).toEqual([
    'packages/features/demo/engine/runtime.ts → packages/features/other/contract.ts (demo dependsOn other)',
    'packages/features/demo/engine/types.ts → packages/features/other/contract.ts (demo dependsOn other)',
  ]);
  expect(
    findUndeclaredImports(imports, [{ id: 'demo', dependsOn: ['other'] }, { id: 'other' }]),
  ).toEqual([]);
});

test('production feature imports match the registered dependsOn declarations', async () => {
  const imports = await featureImports(workspace, 'tsconfig.base.json');
  expect(imports).toContainEqual(
    expect.objectContaining({
      from: 'packages/features/measurements/engine/commands.ts',
      to: 'packages/features/components/contract.ts',
    }),
  );
  expect(findUndeclaredImports(imports, engineFeatures)).toEqual([]);
});
