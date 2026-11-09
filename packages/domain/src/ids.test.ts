import { expect, test } from 'vitest';
import * as domain from './index';
import type { IdPrefix } from './index';

test('entity and pin IDs have the requested prefix and ten URL-safe random characters', () => {
  expect(domain.newId).toBeTypeOf('function');
  const prefixes: IdPrefix[] = [
    'cmp',
    'jun',
    'con',
    'lbl',
    'rol',
    'msr',
    'rep',
    'pho',
    'dim',
    'are',
    'att',
    'txt',
    'chk',
    'pin',
  ];
  for (const prefix of prefixes) {
    const first = domain.newId(prefix);
    const second = domain.newId(prefix);
    expect(first).toMatch(new RegExp(`^${prefix}_[A-Za-z0-9_-]{10}$`));
    expect(second).toMatch(new RegExp(`^${prefix}_[A-Za-z0-9_-]{10}$`));
    expect(first).not.toBe(second);
  }
});
