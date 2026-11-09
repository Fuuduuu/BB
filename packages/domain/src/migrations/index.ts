import { CURRENT_FORMAT_VERSION } from '../constants';

export type Migration = { from: number; up(doc: unknown): unknown };
export const MIGRATIONS: Migration[] = [];

export function migrateDoc(
  raw: unknown,
  from: number,
  migrations: Migration[] = MIGRATIONS,
): unknown {
  if (!Number.isSafeInteger(from) || from < 0 || from > CURRENT_FORMAT_VERSION) {
    throw new RangeError('Unsupported source format version');
  }
  let doc = raw;
  for (let version = from; version < CURRENT_FORMAT_VERSION; version += 1) {
    const steps = migrations.filter((migration) => migration.from === version);
    if (steps.length !== 1) throw new Error(`Expected one migration from format ${version}`);
    const next = steps[0]!.up(doc);
    if (
      next === null ||
      typeof next !== 'object' ||
      !('format_version' in next) ||
      next.format_version !== version + 1
    ) {
      throw new Error(`Migration from format ${version} did not advance its version`);
    }
    doc = next;
  }
  return doc;
}
