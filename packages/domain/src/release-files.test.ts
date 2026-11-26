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

test('release_documents_v060_v070_keep_their_content', () => {
  function loadRelease(version: string) {
    const file = new URL(`./__fixtures__/releases/${version}.document.json`, import.meta.url);
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { format_version: number };
    const migrated = migrateDoc(raw, raw.format_version);
    return validateDocument(BoardDocSchema.parse(migrated));
  }

  const v060 = loadRelease('v0.6.0');
  const continuity = v060.measurements.filter(
    ({ mode, source }) => mode === 'continuity' && source === 'beep_mode',
  );
  expect(continuity.length).toBeGreaterThanOrEqual(2);
  expect(continuity.map(({ beep }) => beep)).toEqual(expect.arrayContaining([true, false]));
  expect(v060.connections).toEqual(
    expect.arrayContaining([expect.objectContaining({ basis: 'assumed' })]),
  );
  expect(v060.roles).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'ground' })]));

  const v070 = loadRelease('v0.7.0');
  expect(v070.scale.calibrated).toBe(true);
  expect(Math.abs((v070.scale.calib?.mm ?? Infinity) - 3.81)).toBeLessThanOrEqual(0.001);
  expect(v070.components.find(({ ref }) => ref === 'C1')?.board?.footprint).toBe('radial');
  expect(v070.components.find(({ ref }) => ref === 'U1')?.board?.footprint).toBe('soic');
});
