import type { Snapshot } from '@pcbk/contracts';
import type { MeasuredPin, Vec2 } from '@pcbk/domain';
import { useSessionStore } from '@pcbk/ui';
import { create } from 'zustand';
import { z } from 'zod';
import { BeepRecordSchema } from '../contract';
import { resolveContact } from './contacts';

export const beepGuardSchema = BeepRecordSchema.pick({
  measurementId: true,
  anchor: true,
  pin: true,
}).extend({
  reason: z.enum(['same_component', 'shorts_component', 'role_conflict']),
  components: z.array(z.string()),
  roles: z.array(z.string()),
});

export type ProbePad = string | number;

interface BeepState {
  anchor: MeasuredPin | null;
  anchorPad: ProbePad | null;
  target: MeasuredPin | null;
  targetAt: Vec2 | null;
  targetPad: ProbePad | null;
  focusTarget: boolean;
  guard: z.infer<typeof beepGuardSchema> | null;
  lastMeasurementId: string | null;
  error: string | null;
}

export const closedBeepTarget = {
  target: null,
  targetAt: null,
  targetPad: null,
  focusTarget: false,
  guard: null,
  lastMeasurementId: null,
  error: null,
};

const initial: BeepState = { anchor: null, anchorPad: null, ...closedBeepTarget };
export const useBeepStore = create<BeepState>(() => initial);

export function resetBeepTool() {
  useBeepStore.setState(initial);
}

export function expireBeepState(snapshot: Snapshot) {
  const { anchor, target, guard } = useBeepStore.getState();
  if (anchor && !resolveContact(snapshot, anchor)) {
    resetBeepTool();
    return;
  }
  const targetExpired = target && !resolveContact(snapshot, target);
  const guardExpired =
    guard &&
    (!resolveContact(snapshot, guard.anchor) ||
      !resolveContact(snapshot, guard.pin) ||
      !snapshot.doc.measurements.some(({ id }) => id === guard.measurementId));
  if (targetExpired || guardExpired) useBeepStore.setState(closedBeepTarget);
}

export function startBeepPair(anchor: MeasuredPin, target: MeasuredPin, targetAt: Vec2) {
  useBeepStore.setState({
    ...closedBeepTarget,
    anchor,
    anchorPad: null,
    target,
    targetAt,
    focusTarget: true,
  });
  useSessionStore.getState().setToolId('measurements.beep');
}
