import { create } from 'zustand';
import type { MeasuredPin, Measurement } from '@pcbk/domain';

export type Power = Measurement['power'];
export type MeasureMode = 'voltage' | 'continuity';
type PairKey = string;
type Draft = { text: string; power: Power };

interface MeasureState {
  measureAt: MeasuredPin | null;
  blackProbe: MeasuredPin | null;
  mode: MeasureMode;
  drafts: Record<PairKey, Draft>;
  lastPower: Power;
  focusTick: number;
  lastSavedId: string | null;
}

interface MeasureStore extends MeasureState {
  setMeasureAt(pin: MeasuredPin): void;
  setBlackProbe(pin: MeasuredPin | null): void;
  setMode(mode: MeasureMode): void;
  setDraft(pair: PairKey, draft: Draft): void;
  clearDraft(pair: PairKey): void;
  requestFocus(): void;
  setLastSaved(id: string, power: Power): void;
  reset(): void;
}

const initial: MeasureState = {
  measureAt: null,
  blackProbe: null,
  mode: 'voltage',
  drafts: {},
  lastPower: 'unknown',
  focusTick: 0,
  lastSavedId: null,
};

export function pairKey(at: MeasuredPin, ref: MeasuredPin | null): PairKey {
  return JSON.stringify([at.uid, ref?.uid ?? null]);
}

export const useMeasureStore = create<MeasureStore>((set) => ({
  ...initial,
  setMeasureAt: (pin) =>
    set((state) => (state.measureAt?.uid === pin.uid ? state : { measureAt: pin })),
  setBlackProbe: (blackProbe) => set({ blackProbe }),
  setMode: (mode) => set({ mode }),
  setDraft: (pair, draft) => set(({ drafts }) => ({ drafts: { ...drafts, [pair]: draft } })),
  clearDraft: (pair) =>
    set(({ drafts }) => {
      const next = { ...drafts };
      delete next[pair];
      return { drafts: next };
    }),
  requestFocus: () => set(({ focusTick }) => ({ focusTick: focusTick + 1 })),
  setLastSaved: (lastSavedId, lastPower) => set({ lastSavedId, lastPower }),
  reset: () => set(initial),
}));
