import type { StorageReason } from '@pcbk/contracts';
import { Button } from '../kit/Button';
import { et } from './i18n/et';

export interface SaveRecoveryActions {
  copyAvailable?: boolean;
  onRetrySave(): void;
  onSaveElsewhere(): void;
}
export function ErrorBar({
  reason,
  onRetrySave,
  onSaveElsewhere,
  copyAvailable = true,
}: SaveRecoveryActions & { reason: StorageReason }) {
  return (
    <div role="alert" className="pcbk-error-bar">
      <strong>{et.save.failed(et.reason[reason])}</strong>
      <div className="pcbk-inline-actions">
        {reason !== 'stale_rev' && <Button onClick={onRetrySave}>{et.common.retry}</Button>}
        <Button
          onClick={onSaveElsewhere}
          disabled={!copyAvailable}
          title={copyAvailable ? undefined : et.project.copyUnavailable}
        >
          {et.common.saveElsewhere}
        </Button>
      </div>
    </div>
  );
}
