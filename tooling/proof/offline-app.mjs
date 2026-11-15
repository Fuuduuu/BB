import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL, URL } from 'node:url';

export const proofOrigin = 'https://bb-proof.test';

/** Build this checkout with its own installed Vite and write only to the proof directory.
 * @param {string} targetRoot @param {string} outputDir */
export async function buildProofApp(targetRoot, outputDir) {
  const root = resolve(targetRoot);
  const requireFromTarget = createRequire(join(root, 'package.json'));
  /** @type {typeof import('vite')} */
  const vite = await import(pathToFileURL(requireFromTarget.resolve('vite')).href);
  const outDir = resolve(outputDir, 'site');
  await mkdir(resolve(outputDir), { recursive: true });
  await mkdir(outDir); // Refuse stale assets from an earlier proof.
  await vite.build({
    root: join(root, 'apps', 'web'),
    configLoader: 'native',
    logLevel: 'warn',
    cacheDir: resolve(outputDir, 'vite-cache'),
    build: { outDir, emptyOutDir: false },
  });
  // The same Git HEAD can have different local edits. Fingerprint the files Chromium will see.
  const hash = createHash('sha256');
  const files = await siteFiles(outDir);
  for (const [name, path] of [...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    hash.update(name + '\0').update(
      createHash('sha256')
        .update(await readFile(path))
        .digest(),
    );
  }
  return hash.digest('hex');
}

/** @param {string} site */
async function siteFiles(site) {
  const entries = await readdir(site, { recursive: true, withFileTypes: true });
  /** @type {Map<string,string>} */
  const files = new Map();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    files.set('/' + relative(site, path).split(sep).join('/'), path);
  }
  return files;
}

/** @param {Pick<import('@playwright/test').BrowserContext, 'route'>} context @param {string} outputDir */
export async function routeProofApp(context, outputDir) {
  const files = await siteFiles(resolve(outputDir, 'site'));
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === 'blob:' || url.protocol === 'data:') return route.continue();
    if (url.origin !== proofOrigin) return route.abort('blockedbyclient');
    let path;
    try {
      path = files.get(url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname));
    } catch {
      // Malformed percent escapes cannot name an emitted asset.
    }
    if (!path) return route.fulfill({ status: 404 });
    // Playwright derives the MIME type from the extension, including for fonts and JS modules.
    return route.fulfill({ path });
  });
}
