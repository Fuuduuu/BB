import { readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const features = fileURLToPath(new URL('../packages/features/', import.meta.url));
const require = createRequire(join(features, 'package.json'));

test('every_feature_subpath_resolves', () => {
  const subpaths: string[] = [];
  for (const module of readdirSync(features, { withFileTypes: true })) {
    if (!module.isDirectory() || module.name === 'node_modules') continue;
    for (const part of readdirSync(join(features, module.name), { withFileTypes: true })) {
      if (part.name === 'contract.ts' && part.isFile()) {
        subpaths.push(`${module.name}/contract`);
      } else if ((part.name === 'engine' || part.name === 'ui') && part.isDirectory()) {
        subpaths.push(`${module.name}/${part.name}`);
      }
    }
  }

  expect(subpaths).toContain('nets/ui');
  for (const subpath of subpaths) {
    const file = require.resolve(`@pcbk/features/${subpath}`);
    expect(statSync(file).isFile(), subpath).toBe(true);
  }
});
