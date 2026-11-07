import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @param {number} lineCount @returns {'ok' | 'warn' | 'error'} */
export function checkLength(lineCount) {
  if (lineCount > 600) return 'error';
  return lineCount > 400 ? 'warn' : 'ok';
}

const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.rs']);
const ignoredDirectories = new Set(['node_modules', 'dist', 'coverage', 'target', 'bindings']);

/** @param {string} directory @returns {Generator<string>} */
function* sourceFiles(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      yield* sourceFiles(path);
    } else if (entry.isFile() && extensions.has(extname(path)) && !path.endsWith('.gen.ts')) {
      yield path;
    }
  }
}

/** @param {string} text */
function countLines(text) {
  if (!text) return 0;
  return text.split(/\r\n|\n|\r/).length - Number(/(?:\r\n|\n|\r)$/.test(text));
}

/** @param {string} root @returns {number} */
export function checkSourceFiles(root) {
  let errors = 0;
  const paths = [
    ...['apps', 'packages', 'tooling', 'tests'].flatMap((name) => [
      ...sourceFiles(join(root, name)),
    ]),
    ...readdirSync(root, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() && extensions.has(extname(entry.name)) && !entry.name.endsWith('.gen.ts'),
      )
      .map((entry) => join(root, entry.name)),
  ];
  for (const path of paths) {
    if (relative(root, path).replaceAll('\\', '/').startsWith('tooling/fixtures/')) continue;
    const lines = countLines(readFileSync(path, 'utf8'));
    const result = checkLength(lines);
    if (result === 'ok') continue;
    console.log(`[${result}] ${relative(root, path)}: ${lines}`);
    if (result === 'error') errors += 1;
  }
  return errors ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = checkSourceFiles(resolve(process.argv[2] ?? process.cwd()));
}
