import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tooling/**/*.test.ts', 'packages/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', 'tooling/fixtures/**'],
  },
});
