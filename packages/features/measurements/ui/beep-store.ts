import type { MeasuredPin, Vec2 } from '@pcbk/domain';
import { useSessionStore } from '@pcbk/ui';
import { create } from 'zustand';
import { z } from 'zod';
import { BeepRecordSchema } from '../contract';

export const beepGuardSchema = BeepRecordSchema.pick({
  measurementId: true,
  anchor: true,
  pin: true,
}).extend({
  reason: z.enum(['same_component', 'shorts_component', 'role_conflict']),
  components: z.array(z.string()),
  roles: z.array(z.string()),
});

interface BeepState {
  anchor: MeasuredPin | null;
  target: MeasuredPin | null;
  targetAt: Vec2 | null;
  guard: z.infer<typeof beepGuardSchema> | null;
  lastMeasurementId: string | null;
  error: string | null;
}

export const closedBeepTarget = {
  target: null,
  targetAt: null,
  guard: null,
  lastMeasurementId: null,
  error: null,
};

const initial: BeepState = { anchor: null, ...closedBeepTarget };
export const useBeepStore = create<BeepState>(() => initial);

export function resetBeepTool() {
  useBeepStore.setState(initial);
}

export function startBeepPair(anchor: MeasuredPin, target: MeasuredPin, targetAt: Vec2) {
  useBeepStore.setState({ ...closedBeepTarget, anchor, target, targetAt });
  useSessionStore.getState().setToolId('measurements.beep');
}
