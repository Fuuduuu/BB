import { create } from 'zustand';
import type { Vec2 } from '@pcbk/domain';

interface CalibrateState {
  a: Vec2 | null;
  b: Vec2 | null;
  cursor: Vec2 | null;
  dialogOpen: boolean;
  error: string | null;
}

interface CalibrateStore extends CalibrateState {
  setA(point: Vec2): void;
  setB(point: Vec2): void;
  setCursor(point: Vec2): void;
  setError(error: string | null): void;
  reset(): void;
}

const initial: CalibrateState = {
  a: null,
  b: null,
  cursor: null,
  dialogOpen: false,
  error: null,
};

export const useCalibrateStore = create<CalibrateStore>((set) => ({
  ...initial,
  setA: (point) =>
    set({ a: { ...point }, b: null, cursor: { ...point }, dialogOpen: false, error: null }),
  setB: (point) => set({ b: { ...point }, cursor: { ...point }, dialogOpen: true, error: null }),
  setCursor: (point) => set({ cursor: { ...point } }),
  setError: (error) => set({ error }),
  reset: () => set(initial),
}));
