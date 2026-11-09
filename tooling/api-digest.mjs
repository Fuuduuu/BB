import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { renderDigest } from './api-digest/render.mjs';

/** @typedef {{ name: string, path: string }} Entrypoint */
/** @typedef {Map<string, ts.SourceFile>} DeclarationFiles */

/** @param {string} path */
function directories(path) {
  return existsSync(path)
    ? readdirSync(path, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name !== 'node_modules')
        .map((entry) => entry.name)
        .sort()
    : [];
}

/** @param {string} root @returns {Entrypoint[]} */
function entrypoints(root) {
  const packages = join(root, 'packages');
  const entries = directories(packages).map((name) => ({
    name,
    path: join(packages, name, 'src', 'index.ts'),
  }));
  const parts = /** @type {const} */ ([
    ['contract', 'contract.ts'],
    ['engine', 'engine/index.ts'],
    ['ui', 'ui/index.tsx'],
  ]);
  for (const name of directories(join(packages, 'features'))) {
    for (const [part, file] of parts) {
      entries.push({
        name: `features-${name}-${part}`,
        path: join(packages, 'features', name, file),
      });
    }
  }
  return entries.filter(({ path }) => existsSync(path));
}

/** @param {readonly ts.Diagnostic[]} diagnostics */
function diagnosticText(diagnostics) {
  return diagnostics
    .map(({ messageText }) => ts.flattenDiagnosticMessageText(messageText, '\n'))
    .join('\n');
}

/** @param {string} root @param {string[]} paths */
function createProgram(root, paths) {
  const configPath = join(root, 'tsconfig.json');
  const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
  if (error) throw new Error(diagnosticText([error]));
  const { options, errors } = ts.parseJsonConfigFileContent(
    { ...config, files: paths, include: [] },
    ts.sys,
    root,
    undefined,
    configPath,
  );
  if (errors.length) throw new Error(diagnosticText(errors));
  return ts.createProgram(paths, {
    ...options,
    declaration: true,
    declarationMap: false,
    emitDeclarationOnly: true,
    noEmit: false,
    noEmitOnError: false,
    incremental: false,
    composite: false,
  });
}

// Use the compiler's declarations for inferred types and overloads. The callback
// keeps them in memory and associates them with the sources resolved by the checker.
/** @param {ts.Program} program @returns {DeclarationFiles} */
function declarationFiles(program) {
  /** @type {DeclarationFiles} */
  const files = new Map();
  const { diagnostics } = program.emit(
    undefined,
    (name, text, _bom, _onError, sources) => {
      if (!sources?.length || !/\.d\.[cm]?ts$/u.test(name)) return;
      const file = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
      for (const source of sources) files.set(source.fileName, file);
    },
    undefined,
    true,
  );
  if (diagnostics.length) throw new Error(diagnosticText(diagnostics));
  return files;
}

/** @param {string} root @param {boolean} check */
function apiDigest(root, check) {
  const entries = entrypoints(root);
  if (!entries.length) throw new Error('API sisenemispunkte ei leitud.');
  const program = createProgram(
    root,
    entries.map(({ path }) => path),
  );
  const checker = program.getTypeChecker();
  const files = declarationFiles(program);
  const output = join(root, 'docs', 'api');
  const generated = new Map(
    entries.map((entry) => [
      `${entry.name}.md`,
      renderDigest(root, entry, program, checker, files),
    ]),
  );
  const extras = existsSync(output)
    ? readdirSync(output, { withFileTypes: true })
        .filter(
          (entry) => entry.isFile() && entry.name.endsWith('.md') && !generated.has(entry.name),
        )
        .map((entry) => entry.name)
        .sort()
    : [];
  const different = [...extras];
  if (!check) mkdirSync(output, { recursive: true });
  for (const [file, contents] of generated) {
    const path = join(output, file);
    const lines = contents.split('\n').length - 1;
    if (lines > 400) console.warn(`[warn] docs/api/${file}: ${lines} rida`);
    if (existsSync(path) && readFileSync(path, 'utf8').replaceAll('\r\n', '\n') === contents)
      continue;
    if (check) different.push(file);
    else writeFileSync(path, contents, 'utf8');
  }
  if (!check) {
    for (const file of extras) unlinkSync(join(output, file));
    return 0;
  }
  if (!different.length) return 0;
  for (const file of different.sort()) console.error(`Erineb: docs/api/${file}`);
  console.error('Kokkuvõtte uuendamiseks käivita pnpm api.');
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) {
      throw new Error('Kasutus: node tooling/api-digest.mjs [--check]');
    }
    process.exitCode = apiDigest(process.cwd(), args[0] === '--check');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
