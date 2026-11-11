import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { renderDigest } from './api-digest/render.mjs';

/** @typedef {{ name: string, path: string, publicName?: string, sources?: Entrypoint[] }} Entrypoint */
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

/** @param {Entrypoint} entry @returns {Entrypoint[] | undefined} */
function reexportedSources(entry) {
  if (basename(entry.path) !== 'index.ts' || !existsSync(entry.path)) return undefined;
  const file = ts.createSourceFile(
    entry.path,
    readFileSync(entry.path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  if (!file.statements.length) return undefined;
  const sources = [];
  for (const statement of file.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      statement.exportClause ||
      statement.isTypeOnly ||
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !/^\.\/[^/]+$/u.test(statement.moduleSpecifier.text)
    ) {
      return undefined;
    }
    const specifier = statement.moduleSpecifier.text;
    const resolved = ts.resolveModuleName(specifier, entry.path, {}, ts.sys).resolvedModule;
    if (!resolved)
      throw new Error(`Re-eksporditud faili ei saa lugeda: ${entry.path}: ${specifier}`);
    const name = basename(resolved.resolvedFileName).replace(/\.tsx?$/u, '');
    sources.push({
      name: `${entry.name}/${name}`,
      publicName: entry.name,
      path: resolved.resolvedFileName,
    });
  }
  return sources.sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** @param {string} root @returns {Entrypoint[]} */
function entrypoints(root) {
  const packages = join(root, 'packages');
  /** @type {Entrypoint[]} */
  const entries = directories(packages)
    .filter((name) => name !== 'domain')
    .map((name) => ({
      name,
      path: join(packages, name, 'src', 'index.ts'),
    }));
  const domain = join(packages, 'domain');
  const manifest = join(domain, 'package.json');
  if (existsSync(manifest)) {
    const { exports } = JSON.parse(readFileSync(manifest, 'utf8'));
    for (const [subpath, target] of Object.entries(exports).sort(([a], [b]) =>
      a.localeCompare(b, 'en'),
    )) {
      if (subpath === '.') continue;
      if (!subpath.startsWith('./') || typeof target !== 'string') {
        throw new Error(`Vigane domeeni alamtee: ${subpath}`);
      }
      const entry = { name: `domain/${subpath.slice(2)}`, path: join(domain, target) };
      entries.push({ ...entry, sources: reexportedSources(entry) });
    }
  }
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

/** @param {Entrypoint[]} entries */
function domainContents(entries) {
  const lines = [
    '<!-- Genereeritud: pnpm api. Ära muuda käsitsi. -->',
    '',
    '# @pcbk/domain',
    '',
    'Avalik liides alamteede kaupa:',
  ];
  for (const { name, sources } of entries) {
    const subpath = name.slice('domain/'.length);
    lines.push('', `### \`./${subpath}\``, '');
    if (sources) {
      for (const source of sources) {
        lines.push(
          `- [${source.name.slice(name.length + 1)}](${source.name.replaceAll('/', '-')}.md)`,
        );
      }
    } else {
      lines.push(`- [${subpath}](${name.replaceAll('/', '-')}.md)`);
    }
  }
  return `${lines.join('\n')}\n`;
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
  const declared = entrypoints(root);
  const entries = [
    ...new Map(
      declared.flatMap((entry) => entry.sources ?? [entry]).map((entry) => [entry.name, entry]),
    ).values(),
  ];
  if (!entries.length) throw new Error('API sisenemispunkte ei leitud.');
  const program = createProgram(root, [...new Set(entries.map(({ path }) => path))]);
  const checker = program.getTypeChecker();
  const files = declarationFiles(program);
  const output = join(root, 'docs', 'api');
  const generated = new Map(
    entries.map((entry) => [
      `${entry.name.replaceAll('/', '-')}.md`,
      renderDigest(
        root,
        { ...entry, name: entry.publicName ?? entry.name },
        program,
        checker,
        files,
      ),
    ]),
  );
  const domain = declared.filter(({ name }) => name.startsWith('domain/'));
  if (domain.length) generated.set('domain.md', domainContents(domain));
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
