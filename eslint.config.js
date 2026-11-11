import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const engineImports = {
  group: ['@pcbk/engine', '@pcbk/engine/*', '**/engine', '**/engine/**'],
  message: 'UI kasutab mootorit ainult @pcbk/contracts ja @pcbk/client kaudu.',
};

export default defineConfig([
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/target/**',
      '.superpowers/**',
      '.claude/worktrees/**',
      'prototype/**',
      'tools/**',
      'tooling/fixtures/**',
    ],
  },
  {
    files: ['**/*.{js,cjs,mjs,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', __dirname: 'readonly' },
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['packages/ui/**/*.{ts,tsx}', 'packages/features/*/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [engineImports] }],
    },
  },
]);
