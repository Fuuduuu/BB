import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/** @typedef {Awaited<ReturnType<typeof import('../../apps/desktop/src/perf/probe-gestures').measureGestures>>} Gestures */
/** @typedef {Awaited<ReturnType<typeof import('../../apps/desktop/src/perf/probe-commands').measureCommands>>[number]} CommandSample */
/** @typedef {Awaited<ReturnType<typeof import('../../apps/desktop/src/perf/ipc-timing').measureProjectIpc>>[number]} IpcSample */
/** @typedef {import('../../apps/desktop/src/perf/probe-inputs').ProbeInputCounts} Input */
/** @typedef {{ key: string } & Pick<CommandSample, 'command' | 'view'>} CommandGroup */
/**
 * @typedef {Gestures & {
 *   valid: boolean,
 *   invalidReasons: string[],
 *   hasFocus: boolean,
 *   visibilityState: string,
 *   seed: number,
 *   window: { width: number, height: number },
 *   open: { runsMs: number[], medianMs: number },
 *   schematic: Gestures & { drag: { command: string, view: string } },
 *   input: Input & { measurementsAfterAnchoring: number },
 *   ipc: { samples: IpcSample[] },
 *   commands: { samples: CommandSample[] },
 * }} NativeRun
 */

const out = process.argv[2];
if (!out) throw new Error('Usage: node summarize-native.mjs <directory>');
const directory = resolve(out);
/** @param {string} file */
const read = async (file) => JSON.parse(await readFile(join(directory, file), 'utf8'));
const build = await read('native-build.json');
const runs = await Promise.all(
  [1, 2, 3].map(async (index) => {
    const artifact = 'acceptance-' + index + '-perf.json';
    /** @type {NativeRun} */
    const run = await read(artifact);
    return { ...run, artifact };
  }),
);

assert.match(build.commit, /^[0-9a-f]{40}$/u);
assert.equal(typeof build.clean, 'boolean');
assert.ok(build.version);
assert.match(build.exeSha256, /^[0-9a-f]{64}$/u);

/** @type {CommandGroup[]} */
const commandGroups = [
  { key: 'items.translate.board', command: 'items.translate', view: 'board' },
  { key: 'items.translate.schematic', command: 'items.translate', view: 'schematic' },
  { key: 'connections.add', command: 'connections.add' },
  { key: 'beep.record', command: 'beep.record' },
];
const commandMetrics = /** @type {const} */ ([
  'validateMs',
  'derivedMs',
  'validateAndDerivedMs',
  'executeMs',
]);

/** @param {NativeRun} run @param {CommandGroup} group */
function commandSamples(run, group) {
  return run.commands.samples.filter(
    ({ command, view }) =>
      command === group.command && (group.view === undefined || view === group.view),
  );
}

/** @param {Gestures} gestures */
function verifyGestures({ pan, zoom, drag }) {
  assert.equal(pan.frames, 180);
  assert.equal(zoom.frames, 180);
  assert.equal(drag.frames, 120);
  assert.ok(drag.committed && drag.revDelta === 1 && drag.previewFrames >= 110);
}

for (const run of runs) {
  assert.ok(
    run.valid && !run.invalidReasons.length && run.hasFocus && run.visibilityState === 'visible',
  );
  assert.equal(run.seed, 127);
  assert.equal(run.window.width, 1280);
  assert.equal(run.window.height, 800);
  assert.equal(run.open.runsMs.length, 3);
  verifyGestures(run);
  verifyGestures(run.schematic);
  assert.equal(run.schematic.drag.command, 'items.translate');
  assert.equal(run.schematic.drag.view, 'schematic');
  assert.equal(run.input.components, 300);
  assert.equal(run.input.pins, 3000);
  assert.equal(run.input.traces, 1000);
  assert.equal(run.input.schematicSymbols, 300);
  assert.equal(run.input.anchorPins, 51);
  assert.equal(run.input.measurements, run.input.expected.measurements);
  assert.equal(run.input.namedNets, run.input.expected.namedNets);
  assert.equal(run.input.measurementsAfterAnchoring, run.input.measurements + 50);
  for (const group of commandGroups) {
    const samples = commandSamples(run, group);
    assert.equal(samples.length, 5, group.key);
    for (const sample of samples) {
      assert.ok(commandMetrics.every((metric) => Number.isFinite(sample[metric])));
      assert.equal(sample.validateAndDerivedMs, sample.validateMs + sample.derivedMs);
      assert.ok(Object.values(sample.derivedSlotsMs).every(Number.isFinite));
    }
  }
}

/** @param {number[]} values */
function median(values) {
  const result = [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  assert.ok(result !== undefined);
  return result;
}

/** @param {IpcSample['command']} command @returns {(run: NativeRun) => number | undefined} */
const ipc = (command) => (run) =>
  run.ipc.samples.find((sample) => sample.command === command)?.elapsedMs;

/**
 * @param {'ms' | 'fps'} unit
 * @param {(run: NativeRun) => number | undefined} readRun
 * @param {number | null} previous
 * @param {{lt: number} | {gte: number} | null} budget
 */
function measure(unit, readRun, previous = null, budget = null) {
  const values = runs.map((run) => {
    const value = readRun(run);
    assert.ok(value !== undefined && Number.isFinite(value));
    return value;
  });
  const current = median(values);
  const passed =
    budget === null ? null : 'lt' in budget ? current < budget.lt : current >= budget.gte;
  return { unit, runs: values, median: current, previous, budget, passed };
}

// v0.7.0 medians are the M2-2b-5 handover measurements.
const metrics = {
  workbenchAndPhoto: measure('ms', (run) => run.open.medianMs, 984.2, { lt: 1500 }),
  pan: measure('fps', (run) => run.pan.fps, 59.01, { gte: 57.2 }),
  zoom: measure('fps', (run) => run.zoom.fps, 60.0, { gte: 58.2 }),
  drag: measure('fps', (run) => run.drag.fps, 41.86, { gte: 40.6 }),
  zoomSettleWorst: measure('ms', (run) => run.zoomSettle?.worstMs, 66.8),
  projectOpen: measure('ms', ipc('project_open'), 159.6),
  projectSave: measure('ms', ipc('project_save'), 108.7),
};
const schematicMetrics = {
  pan: measure('fps', (run) => run.schematic.pan.fps, null, { gte: 57 }),
  zoom: measure('fps', (run) => run.schematic.zoom.fps, null, { gte: 57 }),
  drag: measure('fps', (run) => run.schematic.drag.fps, null, { gte: 45 }),
};

const derivedSlots = [
  ...new Set(
    runs.flatMap((run) =>
      run.commands.samples.flatMap(({ derivedSlotsMs }) => Object.keys(derivedSlotsMs)),
    ),
  ),
].sort();
for (const key of ['connectionLevels', 'nets', 'pinReadings'])
  assert.ok(derivedSlots.includes(key));

/** @param {CommandGroup} group */
function commandSummary(group) {
  const phases = Object.fromEntries(
    commandMetrics.map((metric) => [
      metric,
      measure('ms', (run) => median(commandSamples(run, group).map((sample) => sample[metric]))),
    ]),
  );
  const derived = Object.fromEntries(
    derivedSlots.map((key) => [
      key,
      measure('ms', (run) =>
        median(
          commandSamples(run, group).map(({ derivedSlotsMs }) => {
            const slot = /** @type {keyof CommandSample['derivedSlotsMs']} */ (key);
            return derivedSlotsMs[slot] ?? 0;
          }),
        ),
      ),
    ]),
  );
  return { ...phases, derivedSlotsMs: derived };
}

const commands = Object.fromEntries(
  commandGroups.map((group) => [group.key, commandSummary(group)]),
);
const failedBudgets = [
  ...Object.entries(metrics).flatMap(([name, gate]) =>
    gate.passed === false ? ['board.' + name] : [],
  ),
  ...Object.entries(schematicMetrics).flatMap(([name, gate]) =>
    gate.passed === false ? ['schematic.' + name] : [],
  ),
];
const excludedRuns = (await readdir(directory))
  .filter((file) => /^rejected-.*[.]json$/u.test(file))
  .sort();

const summary = {
  build,
  procedure: {
    seed: 127,
    runtime: 'Tauri dev / WebView2, isolated probe app, 1280x800',
    boardBaseline: 'v0.7.0, docs/plans/M2-2b-uleandmine.md',
    open: 'Median of three workbench opens per run, followed by the median of three valid runs.',
    gestures: '180 pan frames, 180 zoom frames and one committed 120-frame drag in each view.',
    commands:
      'Five execute samples per command in each run, undone after collection. Medians within and across runs.',
  },
  runs,
  excludedRuns,
  metrics,
  schematicMetrics,
  commands,
  failedBudgets,
};
await writeFile(
  join(directory, 'native-acceptance-summary.json'),
  JSON.stringify(summary, null, 2) + '\n',
  { flag: 'wx' },
);
console.log(JSON.stringify({ build, metrics, schematicMetrics, commands, failedBudgets }, null, 2));
