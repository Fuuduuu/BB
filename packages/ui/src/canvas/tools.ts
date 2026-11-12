import type { DocumentEngine, Snapshot } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import type { JSX, ReactNode } from 'react';
import type { Preview, Selection } from '../shell/session-store';
import type { HitIndex, HitItem } from './hit-index';
import type { SceneTransform } from './stage';

export interface CanvasPointer {
  world: Vec2;
  screen: Vec2;
  hit?: HitItem;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
}

export interface CanvasTool {
  id: string;
  cursor: string;
  onPointerDown(event: CanvasPointer, api: ToolApi): void;
  onPointerMove(event: CanvasPointer, api: ToolApi): void;
  onPointerUp(event: CanvasPointer, api: ToolApi): void;
  onKey?(event: KeyboardEvent, api: ToolApi): boolean;
  overlay?(api: ToolApi): JSX.Element | null;
  onCancel?(api: ToolApi): void;
}

export interface ToolSpec {
  id: string;
  label: string;
  icon: string;
  key?: string;
  group: 'select' | 'draw' | 'measure' | 'mechanical';
  create(): CanvasTool;
}

export interface ToolApi {
  execute: DocumentEngine['execute'];
  select(selection: Selection): void;
  setPreview(preview: Preview | null): void;
  hitIndex: HitIndex;
  snapshot(): Snapshot;
  sceneTransform(): SceneTransform;
}

export type LayerSpec = {
  id: string;
  z: number;
  render(props: { snapshot: Snapshot; preview: Preview | null; zoom: number }): ReactNode;
  hits?(snapshot: Snapshot, zoom: number, sceneTransform: SceneTransform): HitItem[];
};
