import type { DocumentEngine } from '@pcbk/contracts';
import type { AddConnectionsParams } from '@pcbk/features/connections/contract';
import { nextFrame } from './probe-dom';
import type { CommandPhase } from './probe-timing-types';

type CommandSample = {
  command: 'items.translate' | 'connections.add';
  executeMs: number;
  validateMs: number;
  derivedMs: number;
  netsMs: number;
  validateAndDerivedMs: number;
};

function sample(
  engine: DocumentEngine,
  command: CommandSample['command'],
  execute: () => ReturnType<DocumentEngine['execute']>,
): CommandSample {
  const durations: Partial<Record<CommandPhase, number>> = {};
  globalThis.__PCBK_PERF_RECORD_PHASE__ = (phase, duration) => {
    durations[phase] = duration;
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
  if (!result.ok || result.value.rev !== before.rev + 1)
    throw new Error(`Probe command ${command} did not commit: ${JSON.stringify(result)}`);
  if (!engine.undo().ok) throw new Error(`Could not undo probe command ${command}`);
  const { validateDocument: validateMs, derived: derivedMs, nets: netsMs } = durations;
  if (validateMs === undefined || derivedMs === undefined || netsMs === undefined)
    throw new Error(`Probe timing missing for ${command}: ${JSON.stringify(durations)}`);
  return {
    command,
    executeMs,
    validateMs,
    derivedMs,
    netsMs,
    validateAndDerivedMs: validateMs + derivedMs,
  };
}

export async function measureCommands(
  engine: DocumentEngine,
  componentId: string,
  connection: AddConnectionsParams,
): Promise<CommandSample[]> {
  const samples = [];
  for (let index = 0; index < 5; index++) {
    await nextFrame();
    samples.push(
      sample(engine, 'items.translate', () =>
        engine.execute('items.translate', {
          items: [{ kind: 'component', id: componentId }],
          dx: 1,
          dy: 1,
        }),
      ),
    );
    await nextFrame();
    samples.push(
      sample(engine, 'connections.add', () => engine.execute('connections.add', connection)),
    );
  }
  return samples;
}
