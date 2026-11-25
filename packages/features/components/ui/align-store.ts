import { create } from 'zustand';
import type { Vec2 } from '@pcbk/domain';
import type { SelectedAlignPin } from './align';

type FirstPin = { id: string; pinA: SelectedAlignPin };
type FirstTarget = FirstPin & { targetA: Vec2 };
type SecondPin = FirstTarget & { pinB: SelectedAlignPin };
export type AlignScaleStage = SecondPin & {
  step: 5;
  targetB: Vec2;
  ratio: number;
  uncalibrated: boolean;
};
export type AlignStage =
  | { step: 1 }
  | (FirstPin & { step: 2 })
  | (FirstTarget & { step: 3 })
  | (SecondPin & { step: 4 })
  | AlignScaleStage;

interface AlignStore {
  stage: AlignStage;
  cursor: Vec2 | null;
  error: string | null;
  advance(stage: AlignStage, cursor?: Vec2): void;
  setCursor(cursor: Vec2): void;
  setError(error: string): void;
  reset(): void;
}

const initial = { stage: { step: 1 }, cursor: null, error: null } as const;

export const useAlignStore = create<AlignStore>((set) => ({
  ...initial,
  advance: (stage, cursor) => set({ stage, cursor: cursor ?? null, error: null }),
  setCursor: (cursor) => set({ cursor }),
  setError: (error) => set({ error }),
  reset: () => set(initial),
}));
