import { expect, test } from 'vitest';
import * as domain from '../index';
import type { Migration } from '../index';

test('current documents pass through without running migrations', () => {
  expect(domain.migrateDoc).toBeTypeOf('function');
  const current = { format_version: 1, name: 'Plaat' };
  const migrations: Migration[] = [
    {
      from: 1,
      up: () => {
        throw new Error('must not run');
      },
    },
  ];
  expect(domain.migrateDoc(current, 1, migrations)).toBe(current);
});

test('test migration upgrades version zero and preserves source data', () => {
  expect(domain.migrateDoc).toBeTypeOf('function');
  const source = { format_version: 0, name: 'Plaat' };
  const migrations: Migration[] = [
    { from: 0, up: (doc) => ({ ...(doc as object), format_version: 1, upgraded: true }) },
  ];
  expect(domain.migrateDoc(source, 0, migrations)).toEqual({
    format_version: 1,
    name: 'Plaat',
    upgraded: true,
  });
  expect(source).toEqual({ format_version: 0, name: 'Plaat' });
});

test('missing migrations never silently mark an old document as current', () => {
  expect(domain.migrateDoc).toBeTypeOf('function');
  expect(domain.MIGRATIONS).toEqual([]);
  expect(() => domain.migrateDoc({ format_version: 0 }, 0)).toThrow();
});

test.each([-1, 0.5, NaN, Infinity, 2])('invalid or future format %s is rejected', (version) => {
  expect(domain.migrateDoc).toBeTypeOf('function');
  expect(() => domain.migrateDoc({}, version)).toThrow(RangeError);
});

test('ambiguous migrations and an incorrect output version are rejected', () => {
  expect(domain.migrateDoc).toBeTypeOf('function');
  const step: Migration = { from: 0, up: () => ({ format_version: 1 }) };
  expect(() => domain.migrateDoc({}, 0, [step, step])).toThrow();
  expect(() =>
    domain.migrateDoc({}, 0, [{ from: 0, up: () => ({ format_version: 0 }) }]),
  ).toThrow();
});
