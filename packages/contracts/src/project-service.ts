import type { PhotoRef, Vec2 } from '@pcbk/domain';
import type { Unsubscribe } from './document-engine';
import type { EngineError, StorageReason } from './errors';
import type { Result } from './result';

export type SaveStatus =
  | { state: 'saved'; rev: number; at: string }
  | { state: 'pending' }
  | { state: 'saving' }
  | { state: 'error'; reason: StorageReason };

export type BoardView = { zoom: number; pan: Vec2 };

export type ViewState = {
  navigatorWidth: number;
  navigatorOpen: boolean;
  navigatorTab: string;
  contextWidth: number;
  contextOpen: boolean;
  boardView?: BoardView;
  modules?: Record<string, unknown>;
};

export type ProjectInfo = {
  projectId: string;
  readonly fileId: string;
  sessionId: string;
  name: string;
  path: string;
  readOnly: boolean;
  view: ViewState | null;
};

export type CreateReq = { name: string; device?: string; problem?: string; path?: string };
export type OpenReq = { path: string };
export type CopyReq = { dest: string; identity: 'same' | 'new' };
export type BackupsReq = { projectId: string };
export type BackupInfo = {
  file: string;
  fileId?: string;
  kind: 'full' | 'doc';
  at: string;
  base?: string;
};
export type RestoreReq = { backup: string; dest: string };

export interface ProjectService {
  create(req: CreateReq): Promise<Result<ProjectInfo, EngineError>>;
  open(req: OpenReq): Promise<Result<ProjectInfo, EngineError>>;
  close(): Promise<Result<void, EngineError>>;
  discard(): Promise<Result<void, EngineError>>;
  flush(): Promise<Result<void, EngineError>>;
  saveView(view: ViewState): void;
  importPhoto(file: { bytes: ArrayBuffer; name: string }): Promise<Result<PhotoRef, EngineError>>;
  photoUrl(id: string, variant: 'display' | 'original'): string | null;
  copy(req: CopyReq): Promise<Result<ProjectInfo & { fromMemory: boolean }, EngineError>>;
  backups(req?: BackupsReq): Promise<Result<BackupInfo[], EngineError>>;
  restore(req: RestoreReq): Promise<Result<ProjectInfo, EngineError>>;
  status(fn: (s: SaveStatus & { sessionId: string }) => void): Unsubscribe;
}
