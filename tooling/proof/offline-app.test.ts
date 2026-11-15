import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BrowserContext, Route } from '@playwright/test';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { buildProofApp, proofOrigin, routeProofApp } from './offline-app.mjs';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bb-proof-route-'));
  mkdirSync(join(dir, 'site', 'assets'), { recursive: true });
  writeFileSync(join(dir, 'site', 'index.html'), '<title>Katse</title>');
  writeFileSync(join(dir, 'site', 'assets', 'kirja näide.woff2'), 'test font');
  writeFileSync(join(dir, 'summary.json'), '{}');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

async function browser() {
  const register = vi.fn<BrowserContext['route']>();
  await routeProofApp({ route: register }, dir);
  const handler = register.mock.calls[0]?.[1];
  if (!handler) throw new Error('Missing route handler');
  return async (url: string) => {
    const request = { url: () => url, method: () => 'GET' };
    const route = { request: () => request, abort: vi.fn(), continue: vi.fn(), fulfill: vi.fn() };
    await handler(route as unknown as Route, request as ReturnType<Route['request']>);
    return route;
  };
}

test('refuses to mix an existing site with the next run', async () => {
  await expect(buildProofApp(process.cwd(), dir)).rejects.toMatchObject({ code: 'EEXIST' });
});

test('serves the built page and encoded font from this proof run', async () => {
  const visit = await browser();
  const page = await visit(proofOrigin + '/?proof=1');
  expect(page.fulfill).toHaveBeenCalledWith(
    expect.objectContaining({ path: join(dir, 'site', 'index.html') }),
  );
  const font = await visit(proofOrigin + '/assets/kirja%20n%C3%A4ide.woff2');
  expect(font.fulfill).toHaveBeenCalledWith(
    expect.objectContaining({ path: join(dir, 'site', 'assets', 'kirja näide.woff2') }),
  );
});

test('restricts requests to this build and lets Chromium resolve in-memory photo URLs', async () => {
  const visit = await browser();
  expect((await visit('https://other.test/')).abort).toHaveBeenCalled();
  expect((await visit('blob:' + proofOrigin + '/photo')).continue).toHaveBeenCalled();
  expect((await visit('data:image/png;base64,AA==')).continue).toHaveBeenCalled();
  for (const pathname of ['/missing.js', '/assets/%2e%2e%5c%2e%2e%5csummary.json', '/%ZZ']) {
    const result = await visit(proofOrigin + pathname);
    expect(result.fulfill).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
  }
});
