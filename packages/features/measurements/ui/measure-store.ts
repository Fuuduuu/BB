import { create } from 'zustand';
import type { MeasuredPin, Measurement } from '@pcbk/domain';

export type Power = Measurement['power'];
type PairKey = `${string}|${string}`;
type Draft = { text: string; power: Power };

interface MeasureState {
  measureAt: MeasuredPin | null;
  blackProbe: MeasuredPin | null;
  drafts: Record<PairKey, Draft>;
  lastPower: Power;
  focusTick: number;
}

interface MeasureStore extends MeasureState {
  setMeasureAt(pin: MeasuredPin): void;
  setBlackProbe(pin: MeasuredPin | null): void;
  setDraft(pair: PairKey, draft: Draft): void;
  clearDraft(pair: PairKey, savedPower?: Power): void;
  requestFocus(): void;
  reset(): void;
}

const initial: MeasureState = {
  measureAt: null,
  blackProbe: null,
  drafts: {},
  lastPower: 'unknown',
  focusTick: 0,
};

export function pairKey(at: MeasuredPin, ref: MeasuredPin | null): PairKey {
  return `${at.uid}|${ref?.uid ?? '-'}`;
}

export const useMeasureStore = create<MeasureStore>((set) => ({
  ...initial,
  setMeasureAt: (pin) =>
    set((state) => (state.measureAt?.uid === pin.uid ? state : { measureAt: pin })),
  setBlackProbe: (blackProbe) => set({ blackProbe }),
  setDraft: (pair, draft) => set(({ drafts }) => ({ drafts: { ...drafts, [pair]: draft } })),
  clearDraft: (pair, savedPower) =>
    set(({ drafts, lastPower }) => {
      const next = { ...drafts };
      delete next[pair];
      return { drafts: next, lastPower: savedPower ?? lastPower };
    }),
  requestFocus: () => set(({ focusTick }) => ({ focusTick: focusTick + 1 })),
  reset: () => set(initial),
}));
