import type { StorageReason } from '@pcbk/contracts';
import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import type { SaveRecoveryActions } from './ErrorBar';
import { et } from './i18n/et';

export function CloseDialog({
  open,
  reason,
  busy = false,
  copyAvailable = true,
  onCancel,
  onDiscard,
  onRetrySave,
  onSaveElsewhere,
}: SaveRecoveryActions & {
  open: boolean;
  reason: StorageReason;
  busy?: boolean;
  onCancel(): void;
  onDiscard(): void;
}) {
  return (
    <Dialog
      open={open}
      title={et.save.closeTitle(et.reason[reason])}
      onClose={onCancel}
      closeDisabled={busy}
    >
      <div className="pcbk-close-actions" aria-busy={busy}>
        <Button variant="primary" disabled={busy} onClick={onRetrySave}>
          {et.common.retry}
        </Button>
        <Button
          disabled={busy || !copyAvailable}
          onClick={onSaveElsewhere}
          title={copyAvailable ? undefined : et.project.copyUnavailable}
        >
          {et.common.saveElsewhere}
        </Button>
        <div className="pcbk-discard">
          <Button
            variant="danger"
            disabled={busy}
            onClick={onDiscard}
            aria-describedby="pcbk-discard-hint"
          >
            {et.save.discard}
          </Button>
          <p id="pcbk-discard-hint">{et.save.discardHint}</p>
        </div>
      </div>
    </Dialog>
  );
}
