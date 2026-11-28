import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { createServer } from 'vite';
import { appVersionDefine } from '../app-version.mjs';

const probePlugin = new URL('../../apps/desktop/src/perf/probe-timing-plugin.ts', import.meta.url);
/** @type {typeof import('../../apps/desktop/src/perf/probe-timing-plugin')} */
const { probeTimingPlugin } = await import(probePlugin.href);

const { PCBK_NATIVE_PROBE_OUT: out, PCBK_NATIVE_PROBE_READY: ready } = process.env;
if (!out || !ready) throw new Error('Start the server with pnpm perf:native -- --out <directory>.');

const root = fileURLToPath(new URL('../../apps/desktop/', import.meta.url));
process.env.VITE_PCBK_PERF = '1';
process.env.VITE_PCBK_PERF_NEAR = join(out, 'probe-location.pcbk');

const server = await createServer({
  root,
  configFile: false,
  clearScreen: false,
  define: appVersionDefine,
  plugins: [probeTimingPlugin()],
  server: { host: '127.0.0.1', port: 1420, strictPort: true, hmr: false, watch: null },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
});
await server.listen();
await writeFile(ready, '');
server.printUrls();
