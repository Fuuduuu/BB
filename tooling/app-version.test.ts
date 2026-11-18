import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import desktopConfig from '../apps/desktop/vite.config';
import webConfig from '../apps/web/vite.config';

declare const __PCBK_APP_VERSION__: string;

const root = new URL('../', import.meta.url);
const tauri = 'apps/desktop/src-tauri/';

function read(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

function versionOf(section: string | undefined): string | undefined {
  return /^version\s*=\s*"([^"]+)"/m.exec(section ?? '')?.[1];
}

test('app_version_has_one_source', () => {
  expect(JSON.parse(read(tauri + 'tauri.conf.json'))).not.toHaveProperty('version');

  const manifest = read(tauri + 'Cargo.toml');
  const packageSection = manifest
    .split(/\r?\n(?=\[)/)
    .find((section) => section.startsWith('[package]'));
  const version = versionOf(packageSection);
  expect(version).toMatch(/^\d+\.\d+\.\d+/);

  const desktopLock = read(tauri + 'Cargo.lock')
    .split('[[package]]')
    .find((section) => /^name = "pcbk-desktop"$/m.test(section));
  expect(versionOf(desktopLock)).toBe(version);
  expect(__PCBK_APP_VERSION__).toBe(version);
  for (const config of [desktopConfig, webConfig]) {
    expect(config.define).toMatchObject({ __PCBK_APP_VERSION__: JSON.stringify(version) });
  }

  for (const path of [
    'packages/ui/src/app/use-workbench-host.ts',
    'packages/adapters/src/storage-web.ts',
  ]) {
    expect(read(path), path).not.toMatch(/['"]0\.0\.0['"]/);
  }
});
