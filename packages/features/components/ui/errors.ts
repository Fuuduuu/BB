import type { EngineError } from '@pcbk/contracts';
import { et } from '@pcbk/ui';

export function commandError(error: EngineError): string {
  switch (error.code) {
    case 'validation':
      return error.issues.some(
        (issue) => issue.code === 'custom' && issue.message === 'invalid_or_duplicate_ref',
      )
        ? et.component.duplicateRef
        : et.component.invalid;
    case 'not_found':
      return et.component.missing;
    case 'read_only':
      return et.component.readOnly;
    default:
      return et.component.failed;
  }
}
