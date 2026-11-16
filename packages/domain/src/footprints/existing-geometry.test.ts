import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { footprintGeometry } from './index';
import type { FootprintParams } from './types';

test('existing_footprints_geometry_unchanged', () => {
  const baseline = JSON.parse(
    readFileSync('packages/domain/src/footprints/__fixtures__/pre-m1-3-7.json', 'utf8'),
  ) as {
    sourceHead: string;
    entries: { key: string; params: FootprintParams; serialized: string }[];
  };
  expect(baseline.sourceHead).toBe('badd1c8288845318916b3fb601bd598351697900');
  expect(baseline.entries).toHaveLength(206);
  for (const { key, params, serialized } of baseline.entries) {
    expect(JSON.stringify(footprintGeometry(key, params)), `${key} ${JSON.stringify(params)}`).toBe(
      serialized,
    );
    const decimalParams = Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    );
    // Scientific notation is intentionally rejected by readNumber; finite decimal forms are covered.
    if (!Object.values(decimalParams).some((value) => /[eE]/.test(value))) {
      expect(JSON.stringify(footprintGeometry(key, decimalParams))).toBe(serialized);
    }
  }
});
