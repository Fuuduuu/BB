import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { CURRENT_FORMAT_VERSION } from '../packages/domain/src/constants';

test('rust_and_ts_format_versions_match', () => {
  const db = readFileSync(
    new URL('../apps/desktop/src-tauri/src/storage/db.rs', import.meta.url),
    'utf8',
  );
  const rust = /^const CURRENT_FORMAT_VERSION: u32 = (\d+);$/m.exec(db)?.[1];
  if (rust === undefined) throw new Error('Rusti CURRENT_FORMAT_VERSION konstant puudub');
  expect(
    Number(rust),
    `Vormingu versioon erineb: Rust ${rust}, TS ${CURRENT_FORMAT_VERSION}. Tõsta mõlemad koos.`,
  ).toBe(CURRENT_FORMAT_VERSION);
});
