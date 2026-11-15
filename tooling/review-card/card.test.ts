import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, test } from 'vitest';
import {
  findMissingTests,
  findTestDeclarations,
  missingTestDeclarations,
  parseCard,
} from './card.mjs';
import { buildSteps } from './runner.mjs';

const header = '# Testkaart\n\n**Rada:** B\n\n## Tõend\n';

test('reads the evidence list without promoting example values, removed tests or commands', () => {
  const card = parseCard(
    header +
      [
        '- TS:',
        '  - `accepts_old_view` (näide: `old_flag`, `default_value`).',
        '- Asendatud testid:',
        '  - `removed_old_test`',
        '- E2e `real_browser_check`: klõpsa nupule `Save`.',
        '- Rada B käsud: `pnpm check`; `cargo test` pole vaja.',
        '## Üleandmine',
        '- Rust: `irrelevant_name`, `pnpm tauri build --debug`',
      ].join('\n'),
  );
  expect(card.names).toEqual(['accepts_old_view', 'real_browser_check']);
  expect(card).toMatchObject({ lane: 'B', cargoTest: false, tauriBuild: false });
});

test('reads inline lists, historical literal test titles and explicitly requested native commands', () => {
  const card = parseCard(
    header +
      [
        '- Testid (nimega):',
        '  - UI: `press enter, then save`; `reopens the new file`.',
        '- Rust: `opens_cleanly` (näidise identifikaator `old_id`), `can_restore`.',
        '- Käsud: `cargo test --locked`, `pnpm tauri build --debug`.',
      ].join('\n'),
  );
  expect(card.names).toEqual([
    'press enter, then save',
    'reopens the new file',
    'opens_cleanly',
    'can_restore',
  ]);
  expect(card).toMatchObject({ cargoTest: true, tauriBuild: true });
});

test('warns when an indirect list of required tests cannot be resolved', () => {
  const card = parseCard(header + '- E2e: 3 ülaltoodud testi + olemasolevad.');
  expect(card.names).toEqual([]);
  expect(card.warnings.length).toBeGreaterThan(0);
});

test('includes the separate first-step Cargo evidence on lane A card M1-2-4b', () => {
  const markdown = readFileSync(new URL('../../docs/tasks/M1-2-4b.md', import.meta.url), 'utf8');
  const card = parseCard(markdown + '\n- Tõend: `pnpm tauri build --debug`.\n');
  expect(card).toMatchObject({ lane: 'A', cargoTest: true, tauriBuild: false });
  const steps = buildSteps(card, '.');
  expect(steps.find((step) => step.id === 'cargo')?.args).toEqual(
    expect.arrayContaining(['test', '--locked', '--offline']),
  );
});

test('includes named architect amendments and honors native-command exceptions', () => {
  const card = parseCard(
    header +
      '- TS: `first_case`\n- `pnpm tauri build --debug` ei ole vaja.\n' +
      '## Arhitekti täpsustus (enne ehitust)\n- **Lisatest:** `additional_case`.\n' +
      '## Üleandmine\n- **Lisatest:** `historical_example`.',
  );
  expect(card.names).toEqual(['first_case', 'additional_case']);
  expect(card).toMatchObject({ cargoTest: true, tauriBuild: false });
});

test('includes the two test names in the architect answer on J29 card M1-3-10', () => {
  const markdown = readFileSync(new URL('../../docs/tasks/M1-3-10.md', import.meta.url), 'utf8');
  const card = parseCard(markdown + '\n### Arhitekti vastus ehitajale\n- Lisatest: `review_only`.');
  expect(card.names).toHaveLength(11);
  expect(card.kinds.mono_label_half_covers_measured_chromium_box).toEqual(['any']);
  expect(card.kinds.adjacent_readings_do_not_overlap).toEqual(['e2e']);
  expect(card.names).not.toContain('review_only');
});

test('recognizes test declarations in the right suite, ignoring fixture code, comments and helpers', () => {
  const root = mkdtempSync(join(tmpdir(), 'bb-card-declarations-'));
  function file(path: string, contents: string) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
  try {
    file(
      'packages/ui/actions.test.ts',
      [
        "test.each([1])('active_case', () => {});",
        "it.each([1])('valid_parameterized_case (%j)', () => {});",
        "test.each([1])('prefix_with_prose checks %s', () => {});",
        "test('ordinary_case %s', () => {});",
        "// test('not_a_test', () => {});",
        'const sample = "it(\'quoted_example\', () => {})";',
        "test('browser_only', () => {});",
        "it.skip('disabled_case', () => {});",
        "test.todo('future_case');",
        "describe.skip('later', () => { test('disabled_group_case', () => {}); });",
        "describe.skipIf(true)('later', () => { it('condition_off', () => {}); });",
        "it.runIf(true)('condition_on', () => {});",
      ].join('\n'),
    );
    file('tooling/fixtures/sample.test.ts', "test('fixture_example', () => {});");
    file('packages/ui/contract.test-d.ts', "test('static_contract', () => {});");
    file('packages/ui/unused.spec.ts', "test('undiscovered', () => {});");
    file(
      'apps/desktop/src-tauri/tests/feature.rs',
      [
        '#[test]',
        'fn native_case() {}',
        'fn native_helper() {}',
        '#[ignore = "needs a machine"] #[test] fn disabled_rust() {}',
        '#[test] #[ignore] fn another_disabled_rust() {}',
        '/* nested /* test examples */ #[test] fn commented_rust() {} */',
        'const EXAMPLE: &str = r#"#[test] fn quoted_rust() {}"#;',
      ].join('\n'),
    );
    const card = parseCard(
      header +
        [
          '- TS: `active_case`, `valid_parameterized_case`, `static_contract`, `prefix_with_prose`, `ordinary_case`, `not_a_test`, `quoted_example`, `fixture_example`, `undiscovered`.',
          '- Rust: `native_case`, `native_helper`, `commented_rust`, `quoted_rust`.',
          '- E2e: `browser_only`.',
          '- TS: `disabled_case`, `future_case`, `disabled_group_case`, `condition_off`, `condition_on`.',
          '- Rust: `disabled_rust`, `another_disabled_rust`.',
        ].join('\n'),
    );
    expect(findMissingTests(root, card.names, card.kinds)).toEqual([
      'prefix_with_prose',
      'ordinary_case',
      'not_a_test',
      'quoted_example',
      'fixture_example',
      'undiscovered',
      'native_helper',
      'commented_rust',
      'quoted_rust',
      'browser_only',
      'disabled_case',
      'future_case',
      'disabled_group_case',
      'condition_off',
      'disabled_rust',
      'another_disabled_rust',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('links card aliases to source titles, discovery kind and portable paths, retaining named skips', () => {
  const root = mkdtempSync(join(tmpdir(), 'bb-card-links-'));
  const files = {
    'packages/a/labels.test.ts': "test.each([1])(\n  'aligned (%j)', () => {});",
    'packages/b/labels.test.ts': "describe.skip('future', () => { test('aligned', () => {}); });",
    'packages/a/labels.test-d.ts': "it('type_contract', () => {});",
    'apps/web/e2e/labels.spec.ts': "test('aligned', () => {});",
    'apps/desktop/src-tauri/tests/restore.rs': '#[test] #[ignore] fn rust_restore() {}',
  };
  try {
    for (const [file, contents] of Object.entries(files)) {
      const target = join(root, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, contents);
    }
    const card = parseCard(header + '- TS: `aligned`, `type_contract`.\n- Rust: `rust_restore`.');
    const declarations = findTestDeclarations(root, card.names, card.kinds);
    expect(declarations).toHaveLength(4);
    expect(declarations).toEqual(
      expect.arrayContaining([
        {
          name: 'aligned',
          title: 'aligned (%j)',
          kind: 'unit',
          file: 'packages/a/labels.test.ts',
          parameterized: true,
          disabled: false,
          line: 1,
          endLine: 2,
        },
        {
          name: 'aligned',
          title: 'aligned',
          kind: 'unit',
          file: 'packages/b/labels.test.ts',
          parameterized: false,
          disabled: true,
          line: 1,
          endLine: 1,
        },
        {
          name: 'type_contract',
          title: 'type_contract',
          kind: 'type',
          file: 'packages/a/labels.test-d.ts',
          parameterized: false,
          disabled: false,
          line: 1,
          endLine: 1,
        },
        {
          name: 'rust_restore',
          title: 'rust_restore',
          kind: 'rust',
          file: 'apps/desktop/src-tauri/tests/restore.rs',
          parameterized: false,
          disabled: true,
        },
      ]),
    );
    expect(missingTestDeclarations(card.names, card.kinds, declarations)).toEqual(['rust_restore']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
