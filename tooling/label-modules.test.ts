import { createRequire } from 'node:module';
import { cruise, type IConfiguration } from 'dependency-cruiser';
import { expect, test, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });

test('components_and_measurements_do_not_import_each_other', async () => {
  const configuration = createRequire(import.meta.url)(
    '../.dependency-cruiser.cjs',
  ) as IConfiguration;
  const report = await cruise(
    ['packages/features/components/ui', 'packages/features/measurements/ui'],
    { ...configuration.options, ruleSet: configuration, validate: true, outputType: 'json' },
  );
  const { modules, summary } = JSON.parse(report.output as string) as {
    modules: { source: string; dependencies: { resolved: string }[] }[];
    summary: { violations: unknown[] };
  };
  const roots = ['packages/features/components/', 'packages/features/measurements/'];
  for (const [index, root] of roots.entries()) {
    const sources = modules.filter(
      ({ source }) => source.startsWith(`${root}ui/`) && !/\.test\.|\/__tests__\//.test(source),
    );
    expect(sources.length).toBeGreaterThan(0);
    expect(
      sources.flatMap(({ source, dependencies }) =>
        dependencies
          .filter(({ resolved }) => resolved.startsWith(roots[1 - index]!))
          .map(({ resolved }) => `${source} -> ${resolved}`),
      ),
    ).toEqual([]);
  }
  expect(summary.violations).toEqual([]);
});
