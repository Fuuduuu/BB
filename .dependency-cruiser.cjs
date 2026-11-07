const path = require('node:path');

const tests = '(?:[.](?:test|spec)[.][cm]?[jt]sx?$|/(?:__tests__|tests)/)';
const react = '(?:^|/)node_modules/(?:@types/)?react(?:-dom)?(?:/|$)|^react(?:-dom)?(?:/|$)';
const tauri = '(?:^|/)node_modules/@tauri-apps/|^@tauri-apps/';

/** @param {string} name @param {string} from @param {string} to */
const forbid = (name, from, to) => ({
  name,
  severity: 'error',
  from: { path: from, pathNot: tests },
  to: { path: to },
});

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-pure',
      severity: 'error',
      from: { path: '^packages/domain/', pathNot: tests },
      to: {
        pathNot:
          '^packages/domain/|(?:^|/)node_modules/(?:zod|nanoid)(?:/|$)|^(?:zod|nanoid)(?:/|$)',
      },
    },
    forbid(
      'contracts-no-impl',
      '^packages/(?:contracts/|features/[^/]+/contract[.]ts$)',
      `^packages/(?:engine|client|ui|adapters|features)/|^apps/|${react}|${tauri}`,
    ),
    forbid(
      'engine-no-ui',
      '^packages/engine/',
      `^packages/(?:ui|client|adapters|features)/|^apps/|${react}|${tauri}`,
    ),
    forbid(
      'ui-not-engine',
      '^packages/ui/',
      `^packages/(?:engine|adapters|features)/|^apps/|${tauri}`,
    ),
    forbid(
      'feature-ui-not-engine',
      '^packages/features/[^/]+/ui/',
      `^packages/(?:engine|adapters)/|^packages/features/[^/]+/engine/|^apps/|${tauri}`,
    ),
    forbid(
      'feature-engine-no-ui',
      '^packages/features/[^/]+/engine/',
      `^packages/(?:ui|client|adapters)/|^packages/features/[^/]+/ui/|^apps/|${react}|${tauri}`,
    ),
    forbid(
      'client-no-engine',
      '^packages/client/',
      `^packages/(?:engine|ui|adapters|features)/|^apps/|${tauri}`,
    ),
    forbid(
      'adapters-no-ui',
      '^packages/adapters/',
      `^packages/(?:ui|client|features)/|^apps/|${react}`,
    ),
    {
      name: 'contracts-domain-types-only',
      severity: 'error',
      from: { path: '^packages/contracts/', pathNot: tests },
      to: { path: '^packages/domain/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'ui-domain-types-or-geometry',
      severity: 'error',
      from: { path: '^packages/(?:ui/|client/|features/[^/]+/ui/)', pathNot: tests },
      to: {
        path: '^packages/domain/',
        pathNot: '^packages/domain/(?:src/)?geometry(?:/|[.])',
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'engine-public-api-only',
      severity: 'error',
      from: { path: '^packages/(?:features/[^/]+/engine/|adapters/)', pathNot: tests },
      to: { path: '^packages/engine/', pathNot: '^packages/engine/src/index[.]ts$' },
    },
    {
      name: 'feature-private-api',
      severity: 'error',
      from: { path: '^packages/features/([^/]+)/', pathNot: tests },
      to: {
        path: '^packages/features/',
        pathNot: [
          '^packages/features/$1/',
          '^packages/features/[^/]+/contract[.]ts$',
          '^packages/features/[^/]+/ui/index[.]tsx?$',
        ],
      },
    },
    {
      name: 'shared-code-no-node',
      severity: 'error',
      from: {
        path: '^packages/(?:domain/|contracts/|engine/|client/|ui/|features/[^/]+/(?:engine/|ui/|contract[.]ts$))',
        pathNot: tests,
      },
      to: { dependencyTypes: ['core'] },
    },
  ],
  options: {
    baseDir: process.cwd(),
    doNotFollow: { path: 'node_modules' },
    exclude: '(^|/)(?:dist|coverage|[.]superpowers)/',
    tsPreCompilationDeps: true,
    tsConfig: { fileName: path.join(__dirname, 'tsconfig.base.json') },
  },
};
