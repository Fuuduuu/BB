import { afterEach, expect, test, vi } from 'vitest';
import type { ProjectService } from '@pcbk/contracts';
import type { BoardDoc } from '@pcbk/domain';
import { deferred, photoUiFixture } from '../__tests__/ui-fixture';
import * as photoUi from './index';

const opened: ProjectService[] = [];
afterEach(async () => {
  for (const projects of opened.splice(0)) await projects.discard();
});

async function fixture() {
  const fixture = photoUiFixture();
  opened.push(fixture.projects);
  expect((await fixture.projects.create({ name: 'Plaat' })).ok).toBe(true);
  const photo = {
    id: 'pho_import',
    side: 'top',
    name: 'Plaat',
    widthPx: 300,
    heightPx: 200,
    transform: 'none',
  } as const;
  const importPhoto = vi.fn<ProjectService['importPhoto']>(async () => ({
    ok: true,
    value: photo,
  }));
  const projects = { ...fixture.projects, importPhoto };
  const bytes = new Uint8Array([1, 2, 3]).buffer;
  const read = vi.fn(async () => bytes);
  const file = { name: 'Plaat.PNG', arrayBuffer: read } as unknown as File;
  return { ...fixture, projects, importPhoto, bytes, read, file, photo };
}

test('added_photo_is_one_undoable_step', async () => {
  const context = await fixture();
  const before = context.engine.snapshot();
  expect(await photoUi.addPhoto(context.file, context)).toEqual({ ok: true, value: undefined });
  expect(context.importPhoto).toHaveBeenCalledWith({
    bytes: context.bytes,
    name: 'Plaat.PNG',
    session: before.sessionId,
  });
  expect(context.engine.snapshot().doc.photos).toEqual([context.photo]);
  expect(context.engine.snapshot().rev).toBe(before.rev + 1);
  expect(context.host.drainJournal()).toHaveLength(1);
  expect(context.engine.undo().ok).toBe(true);
  expect(context.engine.snapshot().doc.photos).toEqual([]);
  expect(context.engine.snapshot().history.canUndo).toBe(false);
  expect(context.engine.redo().ok).toBe(true);
  expect(context.engine.snapshot().doc.photos).toEqual([context.photo]);
});

test('add_photo_rejects_limit_before_read_or_import', async () => {
  const context = await fixture();
  expect(context.engine.execute('photo.add', { photo: context.photo }).ok).toBe(true);
  expect(await photoUi.addPhoto(context.file, context)).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [{ message: 'photo_limit' }] },
  });
  expect(context.read).not.toHaveBeenCalled();
  expect(context.importPhoto).not.toHaveBeenCalled();
});

test('add_photo_normalizes_empty_filename', async () => {
  const context = await fixture();
  await photoUi.addPhoto({ ...context.file, name: '' } as File, context);
  expect(context.importPhoto).toHaveBeenCalledWith({
    bytes: context.bytes,
    name: 'foto.png',
    session: context.engine.snapshot().sessionId,
  });
});

test('photo_import_after_project_switch_writes_nothing_to_new_project', async () => {
  const readStarted = deferred();
  const readRelease = deferred();
  const openStarted = deferred();
  const openRelease = deferred();
  const importQueued = deferred();
  const context = photoUiFixture((repo) => ({
    ...repo,
    async open(path) {
      openStarted.resolve();
      await openRelease.promise;
      return repo.open(path);
    },
  }));
  opened.push(context.projects);
  expect((await context.projects.create({ name: 'B', path: 'B.pcbk' })).ok).toBe(true);
  expect((await context.projects.close()).ok).toBe(true);
  const originalB = structuredClone(context.store.files.get('B.pcbk')!.doc);
  expect((await context.projects.create({ name: 'A', path: 'A.pcbk' })).ok).toBe(true);
  const originalA = structuredClone(context.engine.snapshot().doc);
  const logicalA = context.engine.snapshot().sessionId;
  const storageA = context.store.locks.get('A.pcbk');
  const bytes = new Uint8Array([137, 80, 78, 71, 65]).buffer;
  const file = {
    name: 'A-only.png',
    async arrayBuffer() {
      readStarted.resolve();
      await readRelease.promise;
      return bytes;
    },
  } as File;
  const projects: ProjectService = {
    ...context.projects,
    importPhoto(input) {
      const pending = context.projects.importPhoto(input);
      importQueued.resolve();
      return pending;
    },
  };
  const importing = photoUi.addPhoto(file, { ...context, projects });
  await readStarted.promise;
  const openingB = context.projects.open({ path: 'B.pcbk' });
  await openStarted.promise;
  expect(context.engine.snapshot().sessionId).toBe(logicalA);
  readRelease.resolve();
  await importQueued.promise;
  expect(context.engine.snapshot().sessionId).toBe(logicalA);
  expect(context.importBytes).not.toHaveBeenCalled();
  openRelease.resolve();
  expect((await openingB).ok).toBe(true);
  const storageB = context.store.locks.get('B.pcbk');
  expect(storageB).toBeDefined();
  expect(storageB).not.toBe(storageA);
  expect(await importing).toEqual({ ok: false, error: { code: 'stale_session' } });
  expect(context.importBytes.mock.calls.filter(([session]) => session === storageB)).toEqual([]);
  expect(context.importBytes.mock.calls.filter(([session]) => session === storageA)).toEqual([]);
  expect(context.engine.snapshot().doc).toEqual(originalB);
  expect((await context.projects.flush()).ok).toBe(true);
  expect(context.store.files.get('A.pcbk')!.doc).toEqual(originalA);
  expect(context.store.files.get('B.pcbk')!.doc).toEqual(originalB);
});

test('photo_import_in_same_session_still_works', async () => {
  const context = photoUiFixture();
  opened.push(context.projects);
  const created = await context.projects.create({ name: 'A', path: 'A.pcbk' });
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  const storageA = context.store.locks.get('A.pcbk');
  expect(storageA).not.toBe(created.value.sessionId);
  const bytes = new Uint8Array([137, 80, 78, 71, 65]).buffer;
  const file = { name: 'A-only.png', arrayBuffer: async () => bytes } as File;
  expect(await photoUi.addPhoto(file, context)).toEqual({ ok: true, value: undefined });
  const added = context.engine.snapshot().doc.photos[0];
  expect(added).toMatchObject({ name: 'A-only.png', widthPx: 300, heightPx: 200 });
  expect(context.importBytes).toHaveBeenCalledExactlyOnceWith(
    storageA,
    bytes,
    added!.id,
    'A-only.png',
  );
  expect((await context.projects.flush()).ok).toBe(true);
  expect(context.store.files.get('A.pcbk')!.doc).toMatchObject({ photos: [added] });
});

test('add_photo_returns_read_and_adapter_failures', async () => {
  const context = await fixture();
  context.read.mockRejectedValueOnce(new Error('Cannot read'));
  expect(await photoUi.addPhoto(context.file, context)).toMatchObject({
    ok: false,
    error: { code: 'storage', reason: 'corrupt_image' },
  });
  expect(context.importPhoto).not.toHaveBeenCalled();
  context.importPhoto.mockRejectedValueOnce(new Error('Adapter failure'));
  expect(await photoUi.addPhoto(context.file, context)).toMatchObject({
    ok: false,
    error: { code: 'storage', reason: 'unknown' },
  });
  expect(context.engine.snapshot().doc.photos).toEqual([]);
});

test('add_photo_preserves_storage_and_read_only_errors', async () => {
  const context = await fixture();
  context.importPhoto.mockResolvedValueOnce({
    ok: false,
    error: { code: 'storage', reason: 'unsupported_image' },
  });
  expect(await photoUi.addPhoto(context.file, context)).toEqual({
    ok: false,
    error: { code: 'storage', reason: 'unsupported_image' },
  });
  context.host.load(
    context.engine.snapshot().sessionId,
    structuredClone(context.engine.snapshot().doc) as BoardDoc,
    true,
  );
  expect(await photoUi.addPhoto(context.file, context)).toEqual({
    ok: false,
    error: { code: 'read_only' },
  });
  expect(context.engine.snapshot().doc.photos).toEqual([]);
});

test('add_photo_rechecks_limit_after_file_read', async () => {
  const context = await fixture();
  context.read.mockImplementationOnce(async () => {
    context.engine.execute('photo.add', { photo: context.photo });
    return context.bytes;
  });
  expect(await photoUi.addPhoto(context.file, context)).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [{ message: 'photo_limit' }] },
  });
  expect(context.importPhoto).not.toHaveBeenCalled();
});

test('add_photo_queue_recovers_after_failure_without_blocking_other_engines', async () => {
  const context = await fixture();
  const other = await fixture();
  let fail!: () => void;
  context.read.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = () => reject(new Error('Unreadable first photo'));
      }),
  );
  const first = photoUi.addPhoto(context.file, context);
  const readSecond = vi.fn(async () => context.bytes);
  const second = photoUi.addPhoto(
    { name: 'Retry.png', arrayBuffer: readSecond } as unknown as File,
    context,
  );
  await expect(photoUi.addPhoto(other.file, other)).resolves.toMatchObject({ ok: true });
  expect(readSecond).not.toHaveBeenCalled();
  fail();
  expect(await first).toMatchObject({
    ok: false,
    error: { code: 'storage', reason: 'corrupt_image' },
  });
  expect(await second).toMatchObject({ ok: true });
  expect(context.engine.snapshot().doc.photos).toEqual([context.photo]);
});

test('add_photo_queued_request_cannot_follow_a_new_session', async () => {
  const context = await fixture();
  let release!: () => void;
  context.read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = () => resolve(context.bytes);
      }),
  );
  const first = photoUi.addPhoto(context.file, context);
  const queuedRead = vi.fn(async () => context.bytes);
  const queued = photoUi.addPhoto(
    { name: 'Queued.png', arrayBuffer: queuedRead } as unknown as File,
    context,
  );
  await vi.waitFor(() => expect(context.read).toHaveBeenCalledOnce());
  await context.projects.discard();
  await context.projects.create({ name: 'Other project' });
  // A new session can import without waiting for the previous session's File reader.
  expect(await photoUi.addPhoto(context.file, context)).toMatchObject({ ok: true });
  release();
  expect(await first).toEqual({ ok: false, error: { code: 'stale_session' } });
  expect(await queued).toEqual({ ok: false, error: { code: 'stale_session' } });
  expect(queuedRead).not.toHaveBeenCalled();
  expect(context.importPhoto).toHaveBeenCalledOnce();
});

test.each(['read', 'import'] as const)(
  'add_photo_does_not_cross_session_during_%s',
  async (stage) => {
    const context = await fixture();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    if (stage === 'read')
      context.read.mockImplementationOnce(async () => {
        await pending;
        return context.bytes;
      });
    else
      context.importPhoto.mockImplementationOnce(async () => {
        await pending;
        return { ok: true, value: context.photo };
      });
    const result = photoUi.addPhoto(context.file, context);
    await Promise.resolve();
    expect((await context.projects.discard()).ok).toBe(true);
    expect((await context.projects.create({ name: 'Teine' })).ok).toBe(true);
    release();
    expect(await result).toMatchObject({ ok: false, error: { code: 'stale_session' } });
    expect(context.engine.snapshot().doc.photos).toEqual([]);
    if (stage === 'read') expect(context.importPhoto).not.toHaveBeenCalled();
  },
);

test.each(['read', 'import'] as const)(
  'add_photo_failed_%s_still_reports_stale_session',
  async (stage) => {
    const context = await fixture();
    let fail!: () => void;
    const pending = new Promise<never>((_resolve, reject) => {
      fail = () => reject(new Error('late failure'));
    });
    if (stage === 'read') context.read.mockImplementationOnce(() => pending);
    else context.importPhoto.mockImplementationOnce(() => pending);
    const result = photoUi.addPhoto(context.file, context);
    await Promise.resolve();
    await context.projects.discard();
    await context.projects.create({ name: 'Teine' });
    fail();
    expect(await result).toEqual({ ok: false, error: { code: 'stale_session' } });
    expect(context.engine.snapshot().doc.photos).toEqual([]);
  },
);
