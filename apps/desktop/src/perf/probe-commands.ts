import type { DocumentEngine, Snapshot } from '@pcbk/contracts';
import { SCHEMATIC_GRID_MM } from '@pcbk/domain/schematic';
import type { AddConnectionsParams } from '@pcbk/features/connections/contract';
import type { BeepRecordParams } from '@pcbk/features/measurements/contract';
import { anchorPinCount } from './probe-branches';
import { nextFrame } from './probe-dom';
import type { CommandPhase } from './probe-timing-types';

type CommandSample = {
  command: 'items.translate' | 'connections.add' | 'beep.record';
  view?: 'board' | 'schematic';
  executeMs: number;
  validateMs: number;
  derivedMs: number;
  netsMs: number;
  connectionLevelsMs: number;
  pinReadingsMs: number;
  derivedSlotsMs: Partial<Record<keyof Snapshot['derived'], number>>;
  validateAndDerivedMs: number;
};

type SampleAction = Pick<CommandSample, 'command' | 'view'> & {
  execute(): ReturnType<DocumentEngine['execute']>;
  check?(before: Snapshot, after: Snapshot): void;
};

function sample(
  engine: DocumentEngine,
  { execute, check, ...action }: SampleAction,
): CommandSample {
  const durations: Partial<Record<CommandPhase, number>> = {};
  globalThis.__PCBK_PERF_RECORD_PHASE__ = (phase, duration) => {
    durations[phase] = (durations[phase] ?? 0) + duration;
  };
  const before = engine.snapshot();
  const start = performance.now();
  let result: ReturnType<DocumentEngine['execute']>;
  let executeMs: number;
  try {
    result = execute();
    executeMs = performance.now() - start;
  } finally {
    globalThis.__PCBK_PERF_RECORD_PHASE__ = undefined;
  }
  const { command } = action;
  if (!result.ok || result.value.rev !== before.rev + 1)
    throw new Error(`Probe command ${command} did not commit: ${JSON.stringify(result)}`);
  const after = engine.snapshot();
  const undo = engine.undo();
  if (!undo.ok || undo.value.rev !== after.rev + 1)
    throw new Error(`Could not undo probe command ${command}`);
  check?.(before, after);
  const { validateDocument: validateMs, derived: derivedMs } = durations;
  if (validateMs === undefined || derivedMs === undefined)
    throw new Error(`Probe timing missing for ${command}: ${JSON.stringify(durations)}`);

  const keys = Object.keys(after.derived) as Array<keyof Snapshot['derived']>;
  const derivedSlotsMs = Object.fromEntries(keys.map((key) => [key, durations[key] ?? 0]));
  return {
    ...action,
    executeMs,
    validateMs,
    derivedMs,
    derivedSlotsMs,
    netsMs: derivedSlotsMs.nets ?? 0,
    connectionLevelsMs: derivedSlotsMs.connectionLevels ?? 0,
    pinReadingsMs: derivedSlotsMs.pinReadings ?? 0,
    validateAndDerivedMs: validateMs + derivedMs,
  };
}

export async function measureCommands(
  engine: DocumentEngine,
  componentId: string,
  connection: AddConnectionsParams,
  nextBeep: () => BeepRecordParams,
): Promise<CommandSample[]> {
  const translate = (view: 'board' | 'schematic', delta: number): SampleAction => ({
    command: 'items.translate',
    view,
    execute: () =>
      engine.execute('items.translate', {
        items: [{ kind: 'component', id: componentId }],
        dx: delta,
        dy: delta,
        view,
      }),
  });
  const samples = [];
  for (let index = 0; index < 5; index++) {
    const beep = nextBeep();
    const actions: SampleAction[] = [
      translate('board', 1),
      translate('schematic', SCHEMATIC_GRID_MM),
      { command: 'connections.add', execute: () => engine.execute('connections.add', connection) },
      {
        command: 'beep.record',
        execute: () => engine.execute('beep.record', beep),
        check(before, after) {
          if (
            after.doc.measurements.length !== before.doc.measurements.length + 1 ||
            after.doc.connections.length !== before.doc.connections.length + 1 ||
            anchorPinCount(after, beep.anchor) !== 52
          )
            throw new Error('Measured beep.record must save one measurement and link the 52nd pin');
        },
      },
    ];
    for (const action of actions) {
      await nextFrame();
      samples.push(sample(engine, action));
    }
  }
  return samples;
}
