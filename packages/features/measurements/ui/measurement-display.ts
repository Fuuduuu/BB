import type { Measurement } from '@pcbk/domain';
import { formatReading } from '@pcbk/domain/measure/reading';
import { measurementListText } from './i18n/et';

export function displayValue({ mode, overload, value, beep }: Measurement): string {
  if (overload) return measurementListText.overload;
  if (mode === 'voltage' && value !== undefined) return formatReading({ value }, mode);
  if (mode === 'continuity' && beep !== undefined) {
    return beep ? measurementListText.beepResult.yes : measurementListText.beepResult.no;
  }
  return measurementListText.unavailable;
}
