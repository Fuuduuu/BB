import { newBoardDoc } from '@pcbk/domain';
import { StorageError } from '@pcbk/engine';
import { expect, test, vi } from 'vitest';
import type { OpenedProjectDto } from './bindings/OpenedProjectDto';
import { createTauriRepository, type TauriInvoke } from './storage-tauri';

const doc = newBoardDoc('Avatud projekt');
const view = {
  navigatorWidth: 300,
  navigatorTab: 'components',
  contextWidth: 320,
  contextOpen: true,
};
const dto: OpenedProjectDto = {
  session: 'opened',
  project_id: 'project-open',
  file_id: 'file-open',
  path: 'C:/Projects/Board.pcbk',
  doc_json: JSON.stringify(doc),
  view_json: JSON.stringify(view),
  format_version: doc.format_version,
  read_only: false,
  saved_at: '2026-11-08T10:00:00.000Z',
};

function mockInvoke() {
  const call = vi.fn<(...args: Parameters<TauriInvoke>) => Promise<unknown>>();
  const invoke: TauriInvoke = <T>(...args: Parameters<TauriInvoke>) => call(...args) as Promise<T>;
  return { call, invoke };
}

test('auto_named_create_retries_on_path_taken', async () => {
  const { call, invoke } = mockInvoke();
  const nextPath = 'C:/Projects/Board (2).pcbk';
  call
    .mockResolvedValueOnce(dto.path)
    .mockRejectedValueOnce({ reason: 'path_taken', actual_rev: null })
    .mockResolvedValueOnce(nextPath)
    .mockResolvedValueOnce({ ...dto, path: nextPath })
    .mockResolvedValueOnce(undefined);
  const repo = createTauriRepository({ invoke });

  await expect(
    repo.create({ name: doc.name, projectId: dto.project_id, doc }),
  ).resolves.toMatchObject({
    path: nextPath,
    projectId: dto.project_id,
    fileId: dto.file_id,
    doc,
  });
  expect(call.mock.calls).toEqual([
    ['default_project_path', { name: doc.name }],
    [
      'project_create',
      {
        path: dto.path,
        project_id: dto.project_id,
        doc_json: JSON.stringify(doc),
        exclusive: true,
      },
    ],
    ['default_project_path', { name: doc.name }],
    [
      'project_create',
      {
        path: nextPath,
        project_id: dto.project_id,
        doc_json: JSON.stringify(doc),
        exclusive: true,
      },
    ],
    ['recent_add', { path: nextPath, project_id: dto.project_id, name: doc.name }],
  ]);
});

test('auto named create stops after three path conflicts', async () => {
  const { call, invoke } = mockInvoke();
  const paths = [
    'C:/Projects/Board.pcbk',
    'C:/Projects/Board (2).pcbk',
    'C:/Projects/Board (3).pcbk',
  ];
  for (const path of paths) {
    call
      .mockResolvedValueOnce(path)
      .mockRejectedValueOnce({ reason: 'path_taken', actual_rev: null });
  }
  const repo = createTauriRepository({ invoke });

  await expect(repo.create({ name: doc.name, projectId: dto.project_id, doc })).rejects.toEqual(
    new StorageError('exists'),
  );
  expect(call.mock.calls.filter(([command]) => command === 'project_create')).toEqual(
    paths.map((path) => [
      'project_create',
      { path, project_id: dto.project_id, doc_json: JSON.stringify(doc), exclusive: true },
    ]),
  );
  expect(call).toHaveBeenCalledTimes(6);
});

test('automatic create does not retry other storage failures', async () => {
  const { call, invoke } = mockInvoke();
  call
    .mockResolvedValueOnce(dto.path)
    .mockRejectedValueOnce({ reason: 'disk_full', actual_rev: null });
  const repo = createTauriRepository({ invoke });

  await expect(repo.create({ name: doc.name, projectId: dto.project_id, doc })).rejects.toEqual(
    new StorageError('disk_full'),
  );
  expect(call).toHaveBeenCalledTimes(2);
});

test('explicit create retains confirmed replacement and never retries', async () => {
  const { call, invoke } = mockInvoke();
  call.mockRejectedValueOnce({ reason: 'path_taken', actual_rev: null });
  const repo = createTauriRepository({ invoke });

  await expect(
    repo.create({ path: dto.path, name: doc.name, projectId: dto.project_id, doc }),
  ).rejects.toEqual(new StorageError('exists'));
  expect(call).toHaveBeenCalledExactlyOnceWith('project_create', {
    path: dto.path,
    project_id: dto.project_id,
    doc_json: JSON.stringify(doc),
    exclusive: false,
  });
});

test('maps StorageErrorDto to StorageError', async () => {
  const { call, invoke } = mockInvoke();
  const repo = createTauriRepository({ invoke });
  call.mockRejectedValueOnce({ reason: 'read_only', actual_rev: null });
  await expect(repo.close('session')).rejects.toEqual(new StorageError('read_only'));
  call.mockRejectedValueOnce({ reason: 'stale_rev', actual_rev: 17 });
  await expect(repo.close('session')).rejects.toMatchObject({
    name: 'StorageError',
    reason: 'unknown',
    actualRev: 17,
  });
  call.mockRejectedValueOnce({ reason: 'unknown_future_reason', actual_rev: 23 });
  await expect(repo.close('session')).rejects.toMatchObject({
    name: 'StorageError',
    reason: 'unknown',
    actualRev: undefined,
  });
  call.mockRejectedValueOnce('backend unavailable');
  await expect(repo.close('session')).rejects.toEqual(new StorageError('unknown'));
});

test('preserves an existing destination error when restoring a backup', async () => {
  const { call, invoke } = mockInvoke();
  const repo = createTauriRepository({ invoke });
  const request = { backup: 'C:/Backups/board.pcbk', dest: dto.path };
  call.mockRejectedValueOnce({ reason: 'exists', actual_rev: null });

  await expect(repo.restore(request)).rejects.toMatchObject({
    name: 'StorageError',
    reason: 'exists',
    actualRev: undefined,
  });
  expect(call).toHaveBeenCalledExactlyOnceWith('project_restore', request);
});

test('adds recent entry after open and copy', async () => {
  const copyDoc = newBoardDoc('Koopia');
  const copyDto = {
    ...dto,
    session: 'copied',
    project_id: 'project-copy',
    path: 'C:/Projects/Copy.pcbk',
    doc_json: JSON.stringify(copyDoc),
    view_json: null,
  };
  const { call, invoke } = mockInvoke();
  call
    .mockResolvedValueOnce(dto)
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce({ opened: copyDto, from_memory: true })
    .mockResolvedValueOnce(undefined);
  const warn = vi.fn();
  const repo = createTauriRepository({ invoke, warn });
  await expect(repo.open(dto.path)).resolves.toEqual({
    session: dto.session,
    path: dto.path,
    projectId: dto.project_id,
    fileId: dto.file_id,
    doc,
    view: {
      ...view,
      navigatorOpen: true,
      boardView: { zoom: 1, pan: { x: 0, y: 0 } },
      modules: {},
    },
    formatVersion: dto.format_version,
    readOnly: false,
    savedAt: dto.saved_at,
  });
  const journal = [
    {
      at: '2026-11-08T10:00:00.000Z',
      kind: 'command',
      commandId: 'project.rename',
      source: 'user',
      summary: 'Renamed',
    },
  ] as const;
  await expect(
    repo.copy({
      session: dto.session,
      dest: copyDto.path,
      identity: 'new',
      projectId: copyDto.project_id,
      copiedFromProjectId: dto.project_id,
      replaceToken: 'confirmed-copy-target',
      doc: copyDoc,
      rev: copyDoc.rev,
      view: null,
      journal: [...journal],
    }),
  ).resolves.toMatchObject({
    session: copyDto.session,
    projectId: copyDto.project_id,
    fileId: copyDto.file_id,
    fromMemory: true,
    doc: copyDoc,
    view: null,
  });
  expect(call.mock.calls).toEqual([
    ['project_open', { path: dto.path }],
    ['recent_add', { path: dto.path, project_id: dto.project_id, name: doc.name }],
    [
      'project_copy',
      {
        session: dto.session,
        dest: copyDto.path,
        project_id: copyDto.project_id,
        copied_from_project_id: dto.project_id,
        exclusive: false,
        replace_token: 'confirmed-copy-target',
        doc_json: copyDto.doc_json,
        rev: copyDoc.rev,
        view_json: null,
        journal: [
          {
            at: journal[0].at,
            kind: 'command',
            command_id: journal[0].commandId,
            request_id: null,
            source: 'user',
            summary: journal[0].summary,
          },
        ],
      },
    ],
    ['recent_add', { path: copyDto.path, project_id: copyDto.project_id, name: copyDoc.name }],
  ]);
  expect(warn).toHaveBeenCalledOnce();
});

test('normal copy exposes false and backups retain file groups including legacy entries', async () => {
  const { call, invoke } = mockInvoke();
  const repo = createTauriRepository({ invoke });
  call.mockResolvedValueOnce({ opened: dto, from_memory: false }).mockResolvedValueOnce(undefined);
  const result = await repo.copy({
    session: dto.session,
    dest: dto.path,
    identity: 'same',
    projectId: dto.project_id,
    doc,
    rev: doc.rev,
    view: null,
    journal: [],
  });
  expect(result).toMatchObject({ fileId: 'file-open', fromMemory: false });
  call.mockResolvedValueOnce([
    { file: 'group/full.pcbk', kind: 'full', at: 'now', base: null, file_id: 'file-open' },
    { file: 'legacy.doc.json', kind: 'doc', at: 'before', base: 'legacy.pcbk', file_id: null },
  ]);
  await expect(repo.backups(dto.project_id)).resolves.toEqual([
    { file: 'group/full.pcbk', kind: 'full', at: 'now', fileId: 'file-open' },
    { file: 'legacy.doc.json', kind: 'doc', at: 'before', base: 'legacy.pcbk' },
  ]);
});

test('exclusive copy forwards the flag to IPC and maps an occupied path to exists', async () => {
  const { call, invoke } = mockInvoke();
  const repo = createTauriRepository({ invoke });
  call.mockRejectedValueOnce({ reason: 'path_taken', actual_rev: null });
  await expect(
    repo.copy({
      session: dto.session,
      dest: 'Rescue.pcbk',
      identity: 'same',
      exclusive: true,
      projectId: dto.project_id,
      doc,
      rev: doc.rev,
      view: null,
      journal: [],
    }),
  ).rejects.toMatchObject({ reason: 'exists' });
  expect(call).toHaveBeenCalledExactlyOnceWith(
    'project_copy',
    expect.objectContaining({ dest: 'Rescue.pcbk', exclusive: true }),
  );
});

test('a recent index write failure keeps the opened session usable', async () => {
  const { call, invoke } = mockInvoke();
  call.mockResolvedValueOnce(dto).mockRejectedValueOnce({ reason: 'disk_full', actual_rev: null });
  const warn = vi.fn();
  const repo = createTauriRepository({ invoke, warn });
  const opened = await repo.open(dto.path);
  await repo.close(opened.session);
  expect(warn).toHaveBeenCalledOnce();
  expect(call).toHaveBeenLastCalledWith('project_close', { session: dto.session });
});
