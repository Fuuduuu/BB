import { create } from 'zustand';
import type { Vec2 } from '@pcbk/domain';

/** Pointer coordinates are transient and have no document or saved-view subscription. */
export const useCursorStore = create<{ world: Vec2 | null }>(() => ({ world: null }));
