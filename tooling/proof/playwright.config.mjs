import { join } from 'node:path';

const dir = process.env.BB_PROOF_DIR;
if (!dir) throw new Error('Käivita pnpm proof M1-3-10.');

/** @type {import('@playwright/test').PlaywrightTestConfig} */
export default {
  testDir: '.',
  testMatch: 'j29.spec.cjs',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  globalTimeout: 5 * 60_000,
  outputDir: join(dir, 'artifacts'),
  reporter: [['list'], ['json', { outputFile: join(dir, 'playwright.json') }]],
  use: {
    browserName: 'chromium',
    baseURL: 'https://bb-proof.test',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'light', use: { colorScheme: 'light' } },
    { name: 'dark', use: { colorScheme: 'dark' } },
  ],
};
