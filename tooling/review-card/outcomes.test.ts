import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { findTestDeclarations } from './card.mjs';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { readCardOutcomes } from './outcomes.mjs';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bb-named-tests-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

type Assertion = { title: string; status: string; location?: { line: number } };
function units(files: Record<string, Assertion[]>) {
  const testResults = Object.entries(files).map(([file, assertions]) => ({
    name: join(dir, file),
    status: assertions.some((a) => a.status === 'failed') ? 'failed' : 'passed',
    assertionResults: assertions,
  }));
  const assertions = Object.values(files).flat();
  writeFileSync(
    join(dir, 'unit.json'),
    JSON.stringify({
      testResults,
      numTotalTests: assertions.length,
      numPassedTests: assertions.filter((a) => a.status === 'passed').length,
      numFailedTests: assertions.filter((a) => a.status === 'failed').length,
      success: assertions.every((a) => a.status !== 'failed'),
    }),
  );
}

function browser(
  title: string,
  runs: {
    projectName: string;
    status: string;
    results: { status: string }[];
    expectedStatus: string;
  }[],
) {
  const stats = Object.fromEntries(
    ['expected', 'unexpected', 'skipped', 'flaky'].map((k) => [
      k,
      runs.filter((t) => t.status === k).length,
    ]),
  );
  writeFileSync(
    join(dir, 'e2e.json'),
    JSON.stringify({
      config: { rootDir: join(dir, 'apps/web/e2e') },
      stats,
      errors: [],
      suites: [
        {
          specs: [],
          suites: [{ specs: [{ title, file: 'board.spec.ts', line: 8, tests: runs }] }],
        },
      ],
    }),
  );
}

const file = 'packages/canvas/layout.test.ts';
const card = (name: string, ...kinds: ('e2e' | 'unit' | 'any' | 'rust')[]) => ({
  names: [name],
  kinds: { [name]: kinds },
  cargoTest: false,
});
const declaration = (name: string, title = name, line = 7) => ({
  name,
  kind: 'unit' as const,
  file,
  title,
  line,
  endLine: line + 1,
  parameterized: name !== title,
  disabled: false,
});

test('links exact titles within the required reporter and every declared file', () => {
  units({
    [file]: [
      { title: 'layout', status: 'passed' },
      { title: 'layout_helper', status: 'failed' },
    ],
  });
  const decl = declaration('layout');
  const options = { root: dir };
  const result = readCardOutcomes(dir, card('layout', 'unit', 'e2e'), [decl], options);
  expect(result.map((row) => [row.kind, row.status])).toEqual([
    ['unit', 'passed'],
    ['e2e', 'unknown'],
  ]);
  const duplicate = { ...decl, file: 'packages/other/layout.test.ts' };
  const [partial] = readCardOutcomes(dir, card('layout', 'unit'), [decl, duplicate], options);
  expect(partial?.status).toBe('not-run');
  expect(partial?.matches).toHaveLength(1);
  const sameFile = { ...decl, line: 20, endLine: 20 };
  expect(readCardOutcomes(dir, card('layout', 'unit'), [decl, sameFile], options)[0]?.status).toBe(
    'unknown',
  );
  expect(readCardOutcomes(dir, card('lay', 'unit'), [], options)[0]?.status).toBe('not-run');
});

test('links only instances of the named parameterized declaration and retains failed or skipped variants', () => {
  const instance = (title: string, status: string, line: number) => ({
    title,
    status,
    location: { line },
  });
  units({
    [file]: [
      instance('angle (90)', 'passed', 8),
      instance('angle (180)', 'failed', 8),
      instance('angle (fixed)', 'skipped', 20),
      instance('angle helper', 'passed', 7),
    ],
  });
  const [row] = readCardOutcomes(dir, card('angle', 'unit'), [declaration('angle', 'angle (%s)')], {
    root: dir,
  });
  expect(row?.status).toBe('failed');
  expect(row?.matches.map((m) => m.title)).toEqual(['angle (90)', 'angle (180)']);
  units({
    [file]: [
      { title: 'angle (90)', status: 'passed' },
      { title: 'angle (180)', status: 'skipped' },
    ],
  });
  expect(
    readCardOutcomes(dir, card('angle', 'unit'), [declaration('angle', 'angle (%s)')], {
      root: dir,
    })[0]?.status,
  ).toBe('skipped');
});

test('one qualified Rust result cannot prove two declarations with the same leaf name', () => {
  const title = 'roundtrip';
  const decl = { ...declaration(title), kind: 'rust' as const, file: 'src/storage.rs' };
  const required = { ...card(title, 'rust'), cargoTest: true };
  writeFileSync(
    join(dir, 'cargo.log'),
    [
      'Running unittests src/lib.rs (target/debug/deps/board)',
      'running 1 test',
      'test storage::tests::roundtrip ... ok',
      'test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out',
    ].join('\n'),
  );
  expect(readCardOutcomes(dir, required, [decl], { root: dir })[0]?.status).toBe('passed');
  const [row] = readCardOutcomes(dir, required, [decl, { ...decl, file: 'src/journal.rs' }], {
    root: dir,
  });
  expect(row?.status).toBe('unknown');
  expect(row?.matches.map((r) => r.fullName)).toEqual(['storage::tests::roundtrip']);
});

test('separates skipped, absent, incomplete and type-checked evidence', () => {
  const check = (name: string) =>
    readCardOutcomes(dir, card(name, 'unit'), [], { root: dir })[0]?.status;
  expect(check('lost')).toBe('unknown');
  units({
    [file]: [
      { title: 'todo', status: 'todo' },
      { title: 'skip', status: 'skipped' },
    ],
  });
  expect(check('lost')).toBe('not-run');
  expect(check('todo')).toBe('skipped');
  expect(check('skip')).toBe('skipped');
  const decl = {
    ...declaration('apiContract'),
    file: 'packages/api.test-d.ts',
    kind: 'type' as const,
  };
  expect(
    readCardOutcomes(dir, card('apiContract', 'unit'), [decl], {
      root: dir,
      typecheckPassed: true,
    })[0]?.status,
  ).toBe('typechecked');
  expect(readCardOutcomes(dir, card('apiContract', 'unit'), [decl], { root: dir })[0]?.status).toBe(
    'unknown',
  );
});

test('Vitest marks an inverted assertion passed but it cannot satisfy a required passing case', () => {
  const title = 'preserves_existing_board';
  const source = join(dir, file);
  mkdirSync(dirname(source), { recursive: true });
  writeFileSync(source, `it.fails('${title}', () => expect(false).toBe(true));`);
  const required = card(title, 'unit');
  const declarations = findTestDeclarations(dir, required.names, required.kinds);
  // The Vitest JSON reporter persists the ordinary passed status for a successful .fails case.
  units({ [file]: [{ title, status: 'passed', location: { line: 1 } }] });
  const [row] = readCardOutcomes(dir, required, declarations, { root: dir });
  expect(declarations[0]).toMatchObject({ title, expectedFailure: true });
  expect(row?.status).toBe('failed');
  expect(row?.matches[0]).toMatchObject({
    title,
    status: 'failed',
    reportedStatus: 'passed',
    expectedFailure: true,
  });
});

test('keeps all Playwright projects, distinguishes retries and expected failures', () => {
  const title = 'j29_reading';
  const runs = [
    {
      projectName: 'light',
      status: 'expected',
      expectedStatus: 'passed',
      results: [{ status: 'passed' }],
    },
    {
      projectName: 'dark',
      status: 'flaky',
      expectedStatus: 'passed',
      results: [{ status: 'failed' }, { status: 'passed' }],
    },
  ];
  browser(title, runs);
  const decl = { ...declaration(title), kind: 'e2e' as const, file: 'apps/web/e2e/board.spec.ts' };
  const result = () => readCardOutcomes(dir, card(title, 'e2e'), [decl], { root: dir })[0];
  expect(result()?.status).toBe('flaky');
  expect(result()?.matches).toHaveLength(2);
  browser(title, [
    {
      projectName: 'light',
      status: 'expected',
      expectedStatus: 'failed',
      results: [{ status: 'failed' }],
    },
  ]);
  expect(result()?.status).toBe('failed');
  browser(title, [
    {
      projectName: 'light',
      status: 'unexpected',
      expectedStatus: 'passed',
      results: [{ status: 'interrupted' }],
    },
  ]);
  expect(result()?.status).toBe('unknown');
});
