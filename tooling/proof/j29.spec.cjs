const { createRequire } = require('node:module');
const { join } = require('node:path');
const { registerJ29Proof } = require('./j29.ts');
const { routeProofApp } = require('./offline-app.mjs');

const target = process.env.BB_PROOF_TARGET;
const dir = process.env.BB_PROOF_DIR;
// Both this wrapper and the accepted cases must register on the target checkout's runner.
const targetRequire = createRequire(join(target, 'package.json'));
const { test } = targetRequire('@playwright/test');
test.beforeEach(async ({ context }) => {
  await routeProofApp(context, dir);
});
registerJ29Proof(test, dir);
targetRequire('./apps/web/e2e/m1-3-labels.spec.ts');
