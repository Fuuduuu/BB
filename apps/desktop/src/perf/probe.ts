import { info } from '@tauri-apps/plugin-log';
import { invoke } from '@tauri-apps/api/core';
import type { Snapshot } from '@pcbk/contracts';
import { et } from '@pcbk/ui';
import { addPhoto } from '@pcbk/features/photo/ui';
import type { createRuntime } from '../runtime';
import { measureProjectIpc } from './ipc-timing';
import { addProbeBranches, anchorPinCount } from './probe-branches';
import { measureCommands } from './probe-commands';
import { canvasCounts, formatResult, showResult, trackForeground } from './probe-dom';
import { measureGestures } from './probe-gestures';
import { observeSchematicDrag } from './probe-input';
import { checkProbeInputs } from './probe-inputs';
import type { ProbeInputCounts } from './probe-inputs';
import { awaitProbeReady, environment, failureResult, selectDenseTarget } from './probe-setup';
import {
  button,
  closeWorkbench,
  openSchematic,
  openWorkbench,
  saveQuiet,
  unwrap,
} from './probe-workbench';
import { generateSyntheticBoard } from './synthetic-board';
import { createSyntheticPhoto } from './synthetic-photo';

export { measureZoomSettle, probeBaseZoom, probeViewportCenter } from './probe-gestures';

type Runtime = ReturnType<typeof createRuntime>;
type SyntheticBoard = ReturnType<typeof generateSyntheticBoard>;

const seed = 127;
const takenAt = '2026-01-01T00:00:00.000Z';

async function populate(runtime: Runtime) {
  const photo = await createSyntheticPhoto();
  unwrap(
    await addPhoto(new File([photo.bytes], photo.name, { type: 'image/jpeg' }), runtime),
    'addPhoto',
  );
  await saveQuiet(runtime);
  const synthetic = generateSyntheticBoard({ seed, ids: runtime.ids, at: takenAt });
  synthetic.components.forEach((component, index) => {
    unwrap(
      runtime.engine.execute('components.add', {
        ...component,
        schematic: synthetic.schematic[index]!,
      }),
      'components.add',
    );
  });
  await saveQuiet(runtime);
  for (const measurement of synthetic.measurements)
    unwrap(runtime.engine.execute('measurements.add', measurement), 'measurements.add');
  unwrap(runtime.engine.execute('connections.add', synthetic.connections), 'connections.add');
  for (const measurement of synthetic.continuity)
    unwrap(runtime.engine.execute('measurements.add', measurement), 'continuity measurements.add');
  for (const label of synthetic.netLabels)
    unwrap(runtime.engine.execute('nets.assign', label), 'nets.assign');
  await saveQuiet(runtime);
  return synthetic;
}

function boardCounts(snapshot: Snapshot) {
  const { components, connections, measurements } = snapshot.doc;
  const continuity = measurements.filter(({ mode }) => mode === 'continuity');
  const traces = connections.filter(({ board }) => board?.kind === 'trace');
  const levels = Object.values(snapshot.derived.connectionLevels ?? {});
  const radial = components.filter(({ board }) => board?.footprint === 'radial');
  const soic = components.filter(({ board }) => board?.footprint === 'soic');
  return {
    radial: radial.length,
    soic: soic.length,
    bottomRadial: radial.filter(({ board }) => board?.side === 'bottom').length,
    bottomSoic: soic.filter(({ board }) => board?.side === 'bottom').length,
    traces: traces.length,
    topTraces: traces.filter(({ board }) => board?.layer === 'top').length,
    bottomTraces: traces.filter(({ board }) => board?.layer === 'bottom').length,
    measurements: measurements.length,
    voltage: measurements.filter(({ mode }) => mode === 'voltage').length,
    continuity: continuity.length,
    beeps: continuity.filter(({ beep }) => beep === true).length,
    noBeeps: continuity.filter(({ beep }) => beep === false).length,
    measuredTraces: levels.filter(({ level }) => level === 'measured').length,
    negativeTraces: levels.filter(({ noContinuity }) => noContinuity).length,
    namedNets: snapshot.derived.nets?.list.filter((net) => net.named).length ?? 0,
  };
}

function readInput(
  snapshot: Snapshot,
  synthetic: SyntheticBoard,
  symbols: number,
  board: ReturnType<typeof boardCounts>,
) {
  return {
    components: snapshot.doc.components.length,
    pins: snapshot.doc.components.reduce((total, component) => total + component.pins.length, 0),
    traces: board.traces,
    schematicSymbols: symbols,
    measurements: board.measurements,
    namedNets: board.namedNets,
    expected: {
      measurements: synthetic.measurements.length + synthetic.continuity.length,
      namedNets: synthetic.netLabels.length,
    },
    seed,
    window: environment().window,
  } satisfies ProbeInputCounts & { seed: number; window: ReturnType<typeof environment>['window'] };
}

function inputFailure(
  input: ProbeInputCounts,
  mismatched: string[],
  projectPath: string,
  reasons: string[],
) {
  return {
    valid: false,
    reason: 'input_count',
    invalidReasons: [...reasons, 'input_count'],
    mismatched,
    input,
    projectPath,
    ...environment(),
  };
}

function verifyBoardEvidence(board: ReturnType<typeof boardCounts>, canvas: SVGSVGElement) {
  const dom = canvasCounts(canvas);
  if (
    dom.bodies !== 300 ||
    dom.pins !== 3000 ||
    board.beeps !== 450 ||
    board.noBeeps !== 50 ||
    board.measuredTraces !== 450 ||
    board.negativeTraces !== 50
  )
    throw new Error(
      `Reopened board evidence differs from the probe workload: ${JSON.stringify({ board, dom })}`,
    );
}

async function measure(runtime: Runtime) {
  let foreground: ReturnType<typeof trackForeground> | undefined;
  const originalPicker = runtime.appHost.pickProjectFile;
  let projectPath: string | undefined;
  try {
    await awaitProbeReady(() => button(et.project.open) !== null);
    foreground = trackForeground();
    const creationStart = performance.now();
    const name = 'Jõudlusproov (sünteetiline)';
    const near = import.meta.env.VITE_PCBK_PERF_NEAR;
    const created = unwrap(
      await runtime.projects.create({
        name,
        ...(near ? { path: await invoke<string>('default_project_path', { name, near }) } : {}),
      }),
      'create',
    );
    projectPath = created.path;
    await saveQuiet(runtime);
    const synthetic = await populate(runtime);
    const creationMs = performance.now() - creationStart;
    unwrap(await runtime.projects.close(), 'close created project');
    runtime.appHost.pickProjectFile = async () => created.path;

    const first = await openWorkbench(runtime, created.path);
    const schematicCanvas = await openSchematic();
    const symbols = schematicCanvas.querySelectorAll('[data-symbol]').length;
    await closeWorkbench(runtime);
    const second = await openWorkbench(runtime, created.path);
    await closeWorkbench(runtime);
    const third = await openWorkbench(runtime, created.path);
    const canvas = third.canvas;
    const openMs = [first.elapsed, second.elapsed, third.elapsed];
    const snapshot = runtime.engine.snapshot();
    const board = boardCounts(snapshot);
    const input = readInput(snapshot, synthetic, symbols, board);
    const validation = checkProbeInputs(input);
    if (!validation.ok)
      return inputFailure(input, validation.mismatched, created.path, foreground.reasons());
    verifyBoardEvidence(board, canvas);

    const target = selectDenseTarget(snapshot.doc.components, synthetic.surface);
    if (!target?.board || !target.schematic) throw new Error('No placed drag target');
    const boardFrames = await measureGestures(runtime, canvas, target, 'board');
    const marks = (kind: string) =>
      canvas.querySelectorAll(`[data-layer="components.bodies"] [data-mark="${kind}"]`).length;
    const dom = {
      ...canvasCounts(canvas),
      plusMarks: marks('plus'),
      bandMarks: marks('band'),
      notchMarks: marks('notch'),
    };

    const observeDrag = observeSchematicDrag(runtime);
    const schematic = await (async () => {
      try {
        const opened = await openSchematic();
        const frames = await measureGestures(
          runtime,
          opened,
          target,
          'schematic',
          observeDrag.begin,
        );
        return {
          ...frames,
          drag: { ...frames.drag, ...observeDrag.commit(target.id) },
          target: { id: target.id, at: target.schematic!.at },
        };
      } finally {
        observeDrag.stop();
      }
    })();

    const branches = addProbeBranches(
      runtime.engine,
      runtime.ids,
      takenAt,
      synthetic.sampleConnection,
    );
    const anchored = runtime.engine.snapshot();
    const timedInput = {
      ...input,
      anchorPins: anchorPinCount(anchored, branches.anchor),
      measurementsAfterAnchoring: anchored.doc.measurements.length,
    };
    const anchorValidation = checkProbeInputs(timedInput);
    if (!anchorValidation.ok)
      return inputFailure(
        timedInput,
        anchorValidation.mismatched,
        created.path,
        foreground.reasons(),
      );
    await saveQuiet(runtime);
    const commands = await measureCommands(
      runtime.engine,
      target.id,
      synthetic.sampleConnection,
      branches.nextBeep,
    );
    await closeWorkbench(runtime);
    const ipc = { stage: 'after_gestures', samples: await measureProjectIpc(created.path) };
    const reasons = foreground.reasons();
    return {
      valid: reasons.length === 0,
      invalidReasons: reasons,
      projectPath,
      seed,
      creationMs,
      open: { runsMs: openMs, medianMs: [...openMs].sort((a, b) => a - b)[1]!, budgetMs: 1500 },
      ...boardFrames,
      ...environment(),
      dom,
      board,
      input: timedInput,
      schematic,
      ipc,
      commands: { samples: commands },
      target: { id: target.id, footprint: target.board.footprint, center: target.board.center },
    };
  } catch (error) {
    return failureResult(error, foreground?.reasons(), projectPath);
  } finally {
    runtime.appHost.pickProjectFile = originalPicker;
    foreground?.stop();
  }
}

export async function runPerfProbe(runtime: Runtime) {
  try {
    const result = await measure(runtime);
    const json = JSON.stringify(result);
    console.info(`[perf] ${json}`);
    await info(`[perf] ${json}`);
    const settle =
      'zoomSettle' in result && result.zoomSettle
        ? `\n\nRahunemise pikim kaader: ${result.zoomSettle.worstMs.toFixed(1)} ms (${result.zoomSettle.windowMs} ms vaatlus, fps-ist eraldi)`
        : '';
    showResult(`${formatResult(result)}${settle}`);
  } catch (error) {
    console.error('[perf] probe/log failed', error);
    showResult(`Jõudlusproov ebaõnnestus: ${String(error)}`);
  }
}
