import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { expect, test } from 'vitest';

test('engine_source_has_no_object_rules', () => {
  const source = import.meta.dirname;
  const excluded = /\.(?:test|spec)(?:-d)?\.[cm]?[jt]sx?$/;
  const objectRule =
    /\b(?:components|connections|junctions|netLabels|measurements)\b|\.\s*pins\b|['"`]component['"`]/;
  const violations = readdirSync(source, { recursive: true, withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.[cm]?[jt]sx?$/.test(entry.name) &&
        !excluded.test(entry.name) &&
        !relative(source, entry.parentPath).split(sep).includes('__tests__'),
    )
    .flatMap(({ name, parentPath }) => {
      const path = join(parentPath, name);
      return readFileSync(path, 'utf8')
        .split(/\r?\n/)
        .flatMap((line, index) =>
          objectRule.test(line) ? [`${relative(source, path)}:${index + 1} ${line.trim()}`] : [],
        );
    });

  expect(violations).toEqual([]);
});
