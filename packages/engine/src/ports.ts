import type { BoardDoc, PhotoRef } from '@pcbk/domain';
import type {
  BackupInfo,
  CopyReq,
  CreateReq,
  RestoreReq,
  StorageReason,
  ViewState,
} from '@pcbk/contracts';
import type { JournalEntry } from './types';
export type { IdGen } from '@pcbk/contracts';

export class StorageError extends Error {
  override name = 'StorageError';
  constructor(
    readonly reason: StorageReason,
    readonly actualRev?: number,
  ) {
    super(reason);
  }
}
export type OpenedProject = {
  session: string;
  projectId: string;
  fileId: string;
  path: string;
  doc: unknown;
  view: ViewState | null;
  formatVersion: number;
  readOnly: boolean;
  savedAt?: string;
};
export type CreateProjectReq = CreateReq & { projectId: string; doc: BoardDoc };
export type SaveReq = {
  session: string;
  baseRev: number;
  rev: number;
  doc: BoardDoc;
  journal: JournalEntry[];
};
export type CopyProjectReq = CopyReq & {
  session: string;
  projectId: string;
  copiedFromProjectId?: string;
  doc: BoardDoc;
  rev: number;
  view: ViewState | null;
  journal: JournalEntry[];
};
export interface ProjectRepository {
  create(req: CreateProjectReq): Promise<OpenedProject>;
  open(path: string): Promise<OpenedProject>;
  save(req: SaveReq): Promise<void>;
  saveView(session: string, view: ViewState): Promise<void>;
  copy(req: CopyProjectReq): Promise<OpenedProject & { fromMemory: boolean }>;
  backupFull(session: string, reason: 'migration'): Promise<void>;
  backups(projectId: string): Promise<BackupInfo[]>;
  restore(req: RestoreReq): Promise<OpenedProject>;
  close(session: string): Promise<void>;
}
export interface PhotoStore {
  importPath(session: string, path: string): Promise<PhotoRef>;
  importBytes(session: string, bytes: ArrayBuffer): Promise<PhotoRef>;
  url(id: string, variant: 'display' | 'original'): string;
}
