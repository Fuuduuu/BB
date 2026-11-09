import type { Unsubscribe } from './document-engine';

export interface RecentProject {
  path: string;
  projectId: string;
  name: string;
  device?: string;
  updatedAt: string;
  missing?: boolean;
}

export interface AppHost {
  readonly kind: 'web' | 'desktop';
  recents(): Promise<RecentProject[]>;
  removeRecent(path: string): Promise<void>;
  listOpenable?(): Promise<RecentProject[]>;
  pickProjectFile?(): Promise<string | null>;
  pickSavePath?(suggestedName: string): Promise<string | null>;
  onCloseRequested(handler: () => Promise<boolean>): Unsubscribe;
  onOpenPath(handler: (path: string) => void): Unsubscribe;
  /** Lets the browser check for unsaved work synchronously during beforeunload. */
  protectBeforeUnload?(shouldWarn: () => boolean): Unsubscribe;
  closeNow(): void;
  reload(): void;
  saveDiagnostics(summary: string): Promise<void>;
}
