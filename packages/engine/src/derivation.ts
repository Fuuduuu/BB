import type { BoardDoc } from '@pcbk/domain';
import type { Derived, Snapshot } from '@pcbk/contracts';
import { sealTree } from './immutability';
import { z } from 'zod';
import type { DeriveSpec } from './types';

export function makeSnapshot(
  sessionId: string,
  doc: BoardDoc,
  specs: DeriveSpec[],
  history: Snapshot['history'],
): Snapshot {
  const derived: Derived = {
    unplacedBoard: doc.components.filter((item) => !item.board).map((item) => item.id),
    unplacedSchematic: doc.components.filter((item) => !item.schematic).map((item) => item.id),
  };
  for (const spec of specs) {
    if (spec.key !== 'unplacedBoard' && spec.key !== 'unplacedSchematic')
      throw new Error('unknown_derived_key');
    const input = sealTree({ ...derived });
    derived[spec.key] = z.array(z.string()).parse(spec.run(doc, input));
  }
  return sealTree({ sessionId, rev: doc.rev, doc, derived, history });
}
