import { defineConfig } from 'vite';
import { appVersionDefine } from '../../tooling/app-version.mjs';

export default defineConfig({ define: appVersionDefine });
