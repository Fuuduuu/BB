import { parseViewState, type StorageReason, type ViewState } from '@pcbk/contracts';
import {
  StorageError,
  type JournalEntry,
  type OpenedProject,
  type ProjectRepository,
} from '@pcbk/engine';
import type { BackupInfoDto } from './bindings/BackupInfoDto';
import type { CopyResultDto } from './bindings/CopyResultDto';
import type { JournalDto } from './bindings/JournalDto';
import type { OpenedProjectDto } from './bindings/OpenedProjectDto';
import type { StorageErrorDto } from './bindings/StorageErrorDto';

export type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

const reasons: ReadonlySet<unknown> = new Set<StorageReason>([
  'disk_full',
  'read_only',
  'missing',
  'locked',
  'exists',
  'not_project',
  'too_new',
  'unsupported_image',
  'image_too_large',
  'corrupt_image',
  'unknown',
]);

export function storageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  if (typeof error !== 'object' || error === null || !('reason' in error))
    return new StorageError('unknown');
  const dto = error as Partial<StorageErrorDto>;
  const actual = dto.actual_rev;
  const actualRev =
    typeof actual === 'number' && Number.isSafeInteger(actual) && actual >= 0 ? actual : undefined;
  if (dto.reason === 'stale_rev') return new StorageError('unknown', actualRev);
  if (reasons.has(dto.reason)) return new StorageError(dto.reason as StorageReason, actualRev);
  return new StorageError('unknown');
}

function journalDto(entry: JournalEntry): JournalDto {
  return {
    at: entry.at,
    kind: entry.kind,
    command_id: entry.commandId,
    request_id: entry.requestId ?? null,
    source: entry.source,
    summary: entry.summary,
  };
}

function viewState(json: string | null): ViewState | null {
  if (json === null) return null;
  try {
    return parseViewState(JSON.parse(json));
  } catch {
    return null;
  }
}

export function createTauriRepository({
  invoke,
  warn = console.warn,
}: {
  invoke: TauriInvoke;
  warn?: (message: string) => void;
}): ProjectRepository {
  async function call<T>(command: string, args: Record<string, unknown>): Promise<T> {
    try {
      return await invoke<T>(command, args);
    } catch (error) {
      throw storageError(error);
    }
  }

  function report(message: string) {
    try {
      warn(message);
    } catch {
      // Diagnostics are independent of a successful repository operation.
    }
  }

  async function opened(dto: OpenedProjectDto): Promise<OpenedProject> {
    let doc: unknown;
    try {
      doc = JSON.parse(dto.doc_json);
    } catch {
      await call<void>('project_close', { session: dto.session }).catch(() =>
        report('Vigase dokumendi seansi sulgemine ebaõnnestus.'),
      );
      throw new StorageError('not_project');
    }

    if (typeof doc === 'object' && doc !== null && 'name' in doc && typeof doc.name === 'string') {
      await call<void>('recent_add', {
        path: dto.path,
        project_id: dto.project_id,
        name: doc.name,
      }).catch(() => report('Viimaste projektide loendi uuendamine ebaõnnestus.'));
    }

    return {
      session: dto.session,
      projectId: dto.project_id,
      fileId: dto.file_id,
      path: dto.path,
      doc,
      view: viewState(dto.view_json),
      formatVersion: dto.format_version,
      readOnly: dto.read_only,
      savedAt: dto.saved_at,
    };
  }

  return {
    async create(req) {
      const path = req.path ?? (await call<string>('default_project_path', { name: req.doc.name }));
      return opened(
        await call<OpenedProjectDto>('project_create', {
          path,
          project_id: req.projectId,
          doc_json: JSON.stringify(req.doc),
        }),
      );
    },
    async open(path) {
      return opened(await call<OpenedProjectDto>('project_open', { path }));
    },
    save(req) {
      return call('project_save', {
        session: req.session,
        base_rev: req.baseRev,
        rev: req.rev,
        doc_json: JSON.stringify(req.doc),
        journal: req.journal.map(journalDto),
      });
    },
    saveView(session, view) {
      return call('project_save_view', { session, view_json: JSON.stringify(view) });
    },
    async copy(req) {
      const result = await call<CopyResultDto>('project_copy', {
        session: req.session,
        dest: req.dest,
        project_id: req.projectId,
        copied_from_project_id: req.copiedFromProjectId ?? null,
        doc_json: JSON.stringify(req.doc),
        rev: req.rev,
        view_json: req.view === null ? null : JSON.stringify(req.view),
        journal: req.journal.map(journalDto),
      });
      if (result.from_memory) report('Projektikoopia loodi mälus olevatest andmetest.');
      return { ...(await opened(result.opened)), fromMemory: result.from_memory };
    },
    backupFull(session, reason) {
      return call('project_backup_full', { session, reason });
    },
    async backups(projectId) {
      const items = await call<BackupInfoDto[]>('project_backups', { project_id: projectId });
      return items.map(({ file, file_id, kind, at, base }) => ({
        file,
        ...(file_id === null ? {} : { fileId: file_id }),
        kind,
        at,
        ...(base === null ? {} : { base }),
      }));
    },
    async restore({ backup, dest }) {
      return opened(await call<OpenedProjectDto>('project_restore', { backup, dest }));
    },
    close(session) {
      return call('project_close', { session });
    },
  };
}
