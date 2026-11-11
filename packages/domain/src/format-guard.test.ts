import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { format } from 'prettier';
import { expect, test } from 'vitest';
import { z } from 'zod';
import { CURRENT_FORMAT_VERSION } from './constants';
import { BoardDocSchema } from './model/board';

const fixtures = new URL('./__fixtures__/', import.meta.url);
const snapshotName = `board-doc.v${CURRENT_FORMAT_VERSION}.schema.json`;
const schemaChanged =
  'BoardDoc skeem muutus. Tõsta `CURRENT_FORMAT_VERSION`, lisa migratsioon ja uus skeemifail `board-doc.v<N>.schema.json` või, kui muutus on teadlikult ühilduv, uuenda skeemifail käsuga `pnpm schema:update` ja põhjenda commit’is.';

test('board_doc_schema_matches_format_version_snapshot', async () => {
  const snapshot = new URL(snapshotName, fixtures);
  expect(existsSync(snapshot), schemaChanged).toBe(true);
  const actual = await format(
    JSON.stringify(
      z.toJSONSchema(BoardDocSchema),
      (_key, value: unknown) =>
        value !== null && typeof value === 'object' && !Array.isArray(value)
          ? Object.fromEntries(
              Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
            )
          : value,
      2,
    ),
    { parser: 'json', tabWidth: 2, printWidth: 100, endOfLine: 'lf' },
  );
  expect(actual, schemaChanged).toBe(readFileSync(snapshot, 'utf8'));
});

test('schema_snapshot_name_follows_current_format_version', () => {
  const names = existsSync(fixtures) ? readdirSync(fixtures) : [];
  expect(names, `Puudub skeemifail ${snapshotName} (CURRENT_FORMAT_VERSION).`).toContain(
    snapshotName,
  );
});
