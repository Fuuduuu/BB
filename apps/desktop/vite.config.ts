import { defineConfig } from 'vite';
import { appVersionDefine } from '../../tooling/app-version.mjs';
import { probeTimingPlugin } from './src/perf/probe-timing-plugin';

export default defineConfig({
  define: appVersionDefine,
  plugins: process.env.VITE_PCBK_PERF === '1' ? [probeTimingPlugin()] : [],
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
});
