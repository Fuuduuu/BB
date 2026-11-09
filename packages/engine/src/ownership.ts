import { BoardDocSchema } from '@pcbk/domain';
import type { DocKey } from '@pcbk/domain';
import type { CommandId, EngineError } from '@pcbk/contracts';
import type { Patch } from 'immer';

export function ownershipError(
  command: CommandId,
  patches: Patch[],
  fields: ReadonlySet<DocKey>,
  reserved: ReadonlySet<DocKey>,
): EngineError | undefined {
  for (const patch of patches) {
    const field = patch.path[0];
    if (!isDocKey(field)) {
      return {
        code: 'validation',
        issues: [{ code: 'custom', path: [...patch.path], message: 'unknown_document_field' }],
      };
    }
    if (
      patch.path.length === 0 ||
      field === 'rev' ||
      field === 'format_version' ||
      reserved.has(field) ||
      !fields.has(field)
    ) {
      return { code: 'ownership', field, command };
    }
  }
  return undefined;
}

function isDocKey(key: unknown): key is DocKey {
  return typeof key === 'string' && Object.hasOwn(BoardDocSchema.shape, key);
}
