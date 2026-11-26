import { newBoardDoc } from '@pcbk/domain';
import type { BoardDoc } from '@pcbk/domain';
import type { DeepReadonly, Snapshot } from '@pcbk/contracts';
import { sealTree } from './immutability';
import type { DeriveInput, DeriveSpec } from './types';

function inputUnchanged(
  input: DeriveInput,
  previous: DeepReadonly<BoardDoc>,
  doc: DeepReadonly<BoardDoc>,
): boolean {
  if (typeof input === 'string') return previous[input] === doc[input];
  if (previous[input.key] === doc[input.key]) return true;

  const before = input.select(previous);
  const after = input.select(doc);
  if (before.length !== after.length) return false;
  for (let index = 0; index < before.length; index++) {
    if (before[index] !== after[index]) return false;
  }
  return true;
}

export function createSnapshotBuilder(specs: readonly DeriveSpec[], history: Snapshot['history']) {
  const emptyDoc = newBoardDoc('');
  const defaults: Partial<Snapshot['derived']> = Object.fromEntries(
    specs.map((spec) => [spec.key, spec.schema.parse(spec.initial)]),
  );
  const empty: Snapshot = sealTree({
    sessionId: '',
    rev: emptyDoc.rev,
    doc: emptyDoc,
    // Feature keys are provided by the specs installed in this engine.
    derived: defaults as Snapshot['derived'],
    history,
  });

  function makeSnapshot(
    sessionId: string,
    doc: BoardDoc,
    history: Snapshot['history'],
    previous?: Snapshot,
  ): Snapshot {
    const sameSession = previous?.sessionId === sessionId ? previous : undefined;
    let derived = { ...empty.derived };
    for (const spec of specs) {
      const value =
        sameSession && spec.inputs.every((input) => inputUnchanged(input, sameSession.doc, doc))
          ? sameSession.derived[spec.key]
          : spec.schema.parse(spec.run(doc));
      derived = { ...derived, [spec.key]: value };
    }
    return sealTree({ sessionId, rev: doc.rev, doc, derived, history });
  }

  return { empty, makeSnapshot };
}
