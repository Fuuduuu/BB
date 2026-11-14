import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    maxWorkers: 4,
    include: [
      'tooling/**/*.test.ts',
      'packages/**/*.test.{ts,tsx}',
      'apps/web/src/**/*.test.{ts,tsx}',
      'apps/desktop/src/**/*.test.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', 'tooling/fixtures/**'],
    coverage: {
      provider: 'v8',
      include: ['packages/domain/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/__fixtures__/**', '**/index.ts'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
