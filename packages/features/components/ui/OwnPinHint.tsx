import { useSnapshot } from '@pcbk/client';
import { useSessionStore } from '@pcbk/ui';
import { OWN_PIN_TOOL_ID, useOwnPinError } from './OwnPinTool';
import { ownPinEt } from './i18n/et';
import { ownPinTarget } from './own-pin';

export function OwnPinHint() {
  const active = useSessionStore((state) => state.toolId === OWN_PIN_TOOL_ID);
  return active ? <ActiveOwnPinHint /> : null;
}

function ActiveOwnPinHint() {
  const selection = useSessionStore((state) => state.selection);
  const hasTarget = useSnapshot((snapshot) => Boolean(ownPinTarget(snapshot, selection)));
  const error = useOwnPinError((state) => state.error);
  return (
    <span role="status" data-own-pin-hint="" data-error={error ? '' : undefined}>
      {error ?? (hasTarget ? ownPinEt.clickBoard : ownPinEt.selectComponent)}
    </span>
  );
}
