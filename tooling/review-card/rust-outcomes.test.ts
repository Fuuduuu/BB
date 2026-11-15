import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { readRustOutcomes } from './rust-outcomes.mjs';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bb-cargo-report-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function log(...lines: string[]) {
  writeFileSync(join(dir, 'cargo.log'), lines.join('\r\n') + '\r\n');
  return readRustOutcomes(dir);
}

const ok =
  'test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.1s';

test('reads individual outcomes across Rust binaries and preserves duplicate short names', () => {
  const results = log(
    '     Running unittests src\\lib.rs (target\\debug\\deps\\pcbk.exe)',
    'running 1 test',
    'test storage::tests::roundtrip ... ok',
    ok,
    '     Running tests\\journal.rs (target\\debug\\deps\\journal.exe)',
    'running 3 tests',
    'test journal::roundtrip ... FAILED',
    'test import::offline ... ignored, requires a fixture',
    'test rejects_collision - should panic ... ok',
    'failures:',
    '---- journal::roundtrip stdout ----',
    'test printed_by_test ... ok',
    'test result: FAILED. 1 passed; 1 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.01s',
  );
  expect(results).toEqual([
    { fullName: 'storage::tests::roundtrip', title: 'roundtrip', status: 'passed' },
    { fullName: 'journal::roundtrip', title: 'roundtrip', status: 'failed' },
    { fullName: 'import::offline', title: 'offline', status: 'skipped' },
    { fullName: 'rejects_collision', title: 'rejects_collision', status: 'passed' },
  ]);
});

test('empty completed Rust suite has different evidence than a missing or unfinished report', () => {
  expect(readRustOutcomes(dir)).toBeNull();
  expect(log('could not compile pcbk-desktop')).toBeNull();
  expect(
    log(
      'running 0 tests',
      'test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s',
    ),
  ).toEqual([]);
  expect(log('running 1 test', 'test first ... ok')).toBeNull();
  expect(log('running 1 test', 'test first ... ok', ok, '   Doc-tests pcbk_desktop')).toBeNull();
  expect(
    log('running 1 test', 'test first ... ok', ok, 'running 2 tests', 'test second ... ok'),
  ).toBeNull();
});

test('rejects mismatches between listed Rust outcomes, the announced total and the verdict', () => {
  expect(log('running 2 tests', 'test first ... ok', ok)).toBeNull();
  expect(log('running 1 test', 'test first ... FAILED', ok)).toBeNull();
  expect(log('running 1 test', 'test first ... ok', ok.replace('ok.', 'FAILED.'))).toBeNull();
});
