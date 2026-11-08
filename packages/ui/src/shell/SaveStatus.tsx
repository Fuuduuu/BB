import type { SaveStatus as Status } from '@pcbk/contracts';
import { et } from './i18n/et';

export function SaveStatus({ status }: { status: Status }) {
  if (status.state === 'error') return null; // The persistent ErrorBar owns error feedback.
  let label: string = et.save.saving;
  if (status.state === 'saved') {
    const date = new Date(status.at);
    if (Number.isFinite(date.getTime())) {
      label = et.save.saved(
        `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
      );
    }
  }
  return (
    <span role="status" className="pcbk-save-status mono">
      {label}
    </span>
  );
}
