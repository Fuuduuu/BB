import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { validateDocument } from '../../engine/src/invariants';
import { migrateDoc } from './migrations';
import { BoardDocSchema } from './model/board';

test('every_release_document_migrates_and_validates', () => {
  const directory = new URL('./__fixtures__/releases/', import.meta.url);
  const files = readdirSync(directory)
    .filter((name) => name.endsWith('.document.json'))
    .sort();
  expect(files.length, 'At least one release document fixture is required').toBeGreaterThan(0);

  for (const file of files) {
    const raw = JSON.parse(readFileSync(new URL(file, directory), 'utf8')) as {
      format_version: number;
    };
    const migrated = migrateDoc(raw, raw.format_version);
    const parsed = BoardDocSchema.parse(migrated);
    const doc = validateDocument(parsed);

    expect(
      doc.components.find((component) => component.ref === 'R1'),
      file,
    ).toBeDefined();
    const u1 = doc.components.find((component) => component.ref === 'U1');
    expect(u1, file).toBeDefined();
    expect(u1?.pins.find((pin) => pin.id === '3')?.name, file).toBe('FB');
    expect(u1?.pins.find((pin) => pin.id === '8')?.nc, file).toBe(true);
  }
});
