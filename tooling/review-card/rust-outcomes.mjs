import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

/** @typedef {{fullName:string, title:string, status:'passed'|'failed'|'skipped'}} RustOutcome */

/** Read individual libtest results only when each binary's totals agree with its summary.
 * @param {string} runDir @returns {RustOutcome[] | null}
 */
export function readRustOutcomes(runDir) {
  let log;
  try {
    log = readFileSync(join(runDir, 'cargo.log'), 'utf8');
  } catch {
    return null;
  }

  /** @type {RustOutcome[]} */
  const outcomes = [];
  /** @type {{expected:number, start:number} | null} */
  let batch = null;
  let awaitingSuite = false;
  let completedSuite = false;
  let capturedOutput = false;

  for (const line of stripVTControlCharacters(log).split(/\r?\n/)) {
    if (!capturedOutput && /^\s*(?:Running |Doc-tests )/.test(line)) {
      if (batch || awaitingSuite) return null;
      awaitingSuite = true;
      continue;
    }
    const start = !capturedOutput && /^running (\d+) tests?$/.exec(line);
    if (start) {
      if (batch) return null;
      batch = { expected: Number(start[1]), start: outcomes.length };
      awaitingSuite = false;
      continue;
    }
    if (!batch) continue;

    const summary = /^test result: (ok|FAILED)\. (\d+) passed; (\d+) failed; (\d+) ignored;/.exec(
      line,
    );
    if (summary) {
      const rows = outcomes.slice(batch.start);
      const passed = rows.filter((r) => r.status === 'passed').length;
      const failed = rows.filter((r) => r.status === 'failed').length;
      const skipped = rows.length - passed - failed;
      if (
        rows.length !== batch.expected ||
        passed !== Number(summary[2]) ||
        failed !== Number(summary[3]) ||
        skipped !== Number(summary[4]) ||
        (failed === 0) !== (summary[1] === 'ok')
      )
        return null;
      completedSuite = true;
      batch = null;
      capturedOutput = false;
      continue;
    }
    // Test stdout after the outcomes can itself contain libtest-looking lines.
    if (line === 'failures:' || line === 'successes:') capturedOutput = true;
    if (capturedOutput) continue;
    const row = /^test (.+?)\s+(?:- should panic\s+)?\.\.\. (ok|FAILED|ignored(?:,.*)?)$/.exec(
      line,
    );
    if (!row?.[1]) continue;
    const fullName = row[1];
    outcomes.push({
      fullName,
      title: fullName.split('::').at(-1) ?? fullName,
      status: row[2] === 'ok' ? 'passed' : row[2] === 'FAILED' ? 'failed' : 'skipped',
    });
  }
  return completedSuite && !batch && !awaitingSuite ? outcomes : null;
}
