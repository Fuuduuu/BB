import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { format } from 'prettier';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
  root,
  configFile: false,
  server: { middlewareMode: true, watch: null },
  appType: 'custom',
});

try {
  const { BoardDocSchema } = await server.ssrLoadModule('/packages/domain/src/model/board.ts');
  const { CURRENT_FORMAT_VERSION } = await server.ssrLoadModule(
    '/packages/domain/src/constants.ts',
  );
  const schema = BoardDocSchema.toJSONSchema();
  const json = await format(
    JSON.stringify(
      schema,
      (_key, value) =>
        value !== null && typeof value === 'object' && !Array.isArray(value)
          ? Object.fromEntries(
              Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
            )
          : value,
      2,
    ),
    { parser: 'json', tabWidth: 2, printWidth: 100, endOfLine: 'lf' },
  );
  const fixtures = new URL('../packages/domain/src/__fixtures__/', import.meta.url);
  const name = `board-doc.v${CURRENT_FORMAT_VERSION}.schema.json`;
  mkdirSync(fixtures, { recursive: true });
  writeFileSync(new URL(name, fixtures), json);
  console.log(`Uuendatud ${name}`);
} finally {
  await server.close();
}
