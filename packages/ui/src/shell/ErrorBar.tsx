import type { StorageReason } from '@pcbk/contracts';
import { Button } from '../kit/Button';
import { et } from './i18n/et';

export interface SaveRecoveryActions {
  onRetrySave(): void;
  onSaveElsewhere(): void;
}
export function ErrorBar({
  reason,
  onRetrySave,
  onSaveElsewhere,
}: SaveRecoveryActions & { reason: StorageReason }) {
  return (
    <div role="alert" className="pcbk-error-bar">
      <strong>{et.save.failed(et.reason[reason])}</strong>
      <div className="pcbk-inline-actions">
        <Button onClick={onRetrySave}>{et.common.retry}</Button>
        <Button onClick={onSaveElsewhere}>{et.common.saveElsewhere}</Button>
      </div>
    </div>
  );
}
