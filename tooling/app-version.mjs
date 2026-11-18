import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const manifestPath = new URL('../apps/desktop/src-tauri/Cargo.toml', import.meta.url);
const manifest = readFileSync(manifestPath, 'utf8');
const section = /(?:^|\r?\n)\[package\]\r?\n([\s\S]*?)(?=\r?\n\[|$)/.exec(manifest)?.[1];
const version = /^version[ \t]*=[ \t]*"([^"]+)"/m.exec(section ?? '')?.[1];
if (!version) throw new Error('Rakenduse versioon puudub Cargo.toml [package] jaotises.');

export const appVersionDefine = { __PCBK_APP_VERSION__: JSON.stringify(version) };
