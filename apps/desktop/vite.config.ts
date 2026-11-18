import { defineConfig } from 'vite';
import { appVersionDefine } from '../../tooling/app-version.mjs';

export default defineConfig({
  define: appVersionDefine,
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
});
