import { componentEt } from './i18n/et';
import type { EngineError } from '@pcbk/contracts';

export function commandError(error: EngineError): string {
  switch (error.code) {
    case 'internal':
      return 'Sisemine viga, muudatust ei tehtud. Salvesta diagnostika ja anna veast teada.';
    case 'validation':
      return error.issues.some(
        (issue) => issue.code === 'custom' && issue.message === 'invalid_or_duplicate_ref',
      )
        ? componentEt.duplicateRef
        : componentEt.invalid;
    case 'not_found':
      return componentEt.missing;
    case 'read_only':
      return componentEt.readOnly;
    default:
      return componentEt.failed;
  }
}
