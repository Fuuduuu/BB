import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    maxWorkers: 4,
    include: [
      'tooling/**/*.test.ts',
      'packages/**/*.test.{ts,tsx}',
      'apps/web/src/**/*.test.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', 'tooling/fixtures/**'],
  },
});
