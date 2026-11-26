import { alignEt, componentEt, ownPinEt } from './i18n/et';
import type { EngineError } from '@pcbk/contracts';

export function commandError(error: EngineError): string {
  switch (error.code) {
    case 'internal':
      return 'Sisemine viga, muudatust ei tehtud. Salvesta diagnostika ja anna veast teada.';
    case 'validation':
      for (const { code, message } of error.issues) {
        if (code !== 'custom') continue;
        switch (message) {
          case 'invalid_or_duplicate_ref':
            return componentEt.duplicateRef;
          case 'pin_needs_pad':
            return ownPinEt.pinNeedsPad;
          case 'footprint_pin_locked':
            return ownPinEt.footprintPinLocked;
          case 'footprint_pins_mismatch':
            return ownPinEt.footprintPinsMismatch;
          case 'duplicate_pin':
            return ownPinEt.duplicatePin;
          case 'pins_coincide':
            return alignEt.errors.pins_coincide;
          case 'scale_from_pins_out_of_range':
            return alignEt.scaleOutOfRange;
          case 'scale_basis_changed':
            return alignEt.scaleBasisChanged;
          case 'scale_needs_library_pads':
            return alignEt.scaleNeedsLibraryPads;
        }
      }
      return componentEt.invalid;
    case 'not_found':
      return componentEt.missing;
    case 'read_only':
      return componentEt.readOnly;
    default:
      return componentEt.failed;
  }
}
