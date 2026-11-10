import { newBoardDoc } from '@pcbk/domain';
import type { BoardDoc } from '@pcbk/domain';
import type { Snapshot } from '@pcbk/contracts';
import { sealTree } from './immutability';
import type { DeriveSpec } from './types';

export function createSnapshotBuilder(specs: readonly DeriveSpec[], history: Snapshot['history']) {
  const emptyDoc = newBoardDoc('');
  const defaults: Partial<Snapshot['derived']> = {
    unplacedBoard: [],
    unplacedSchematic: [],
    ...Object.fromEntries(specs.map((spec) => [spec.key, spec.schema.parse(spec.initial)])),
  };
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
    let derived: Snapshot['derived'] = {
      ...empty.derived,
      unplacedBoard: doc.components.filter((item) => !item.board).map((item) => item.id),
      unplacedSchematic: doc.components.filter((item) => !item.schematic).map((item) => item.id),
    };
    for (const spec of specs) {
      const value =
        sameSession && spec.inputs.every((field) => sameSession.doc[field] === doc[field])
          ? sameSession.derived[spec.key]
          : spec.schema.parse(spec.run(doc, sealTree(derived)));
      derived = { ...derived, [spec.key]: value };
    }
    return sealTree({ sessionId, rev: doc.rev, doc, derived, history });
  }

  return { empty, makeSnapshot };
}
