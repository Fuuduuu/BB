import { afterEach, expect, test, vi } from 'vitest';
import { projectSetup } from './__tests__/project-helpers';

afterEach(() => vi.useRealTimers());

test('project_info_forwards_repository_file_id_outside_board_document', async () => {
  vi.useFakeTimers();
  const { projects, engine, path } = await projectSetup({
    create: false,
    wrap: (repo) => ({
      ...repo,
      async create(req) {
        return { ...(await repo.create(req)), fileId: 'file_created' };
      },
      async open(path) {
        return { ...(await repo.open(path)), fileId: 'file_created' };
      },
    }),
  });
  try {
    expect(await projects.create({ name: 'Board', path })).toMatchObject({
      ok: true,
      value: { fileId: 'file_created' },
    });
    expect(engine.snapshot().doc).not.toHaveProperty('fileId');
    expect(engine.snapshot().doc).not.toHaveProperty('file_id');
    expect((await projects.close()).ok).toBe(true);
    expect(await projects.open({ path })).toMatchObject({
      ok: true,
      value: { fileId: 'file_created' },
    });
  } finally {
    await projects.discard();
  }
});

test.each([false, true])('copy_result_forwards_file_id_and_from_memory_%s', async (fromMemory) => {
  vi.useFakeTimers();
  const { projects, engine, store, path } = await projectSetup({
    wrap: (repo) => ({
      ...repo,
      async copy(req) {
        return { ...(await repo.copy(req)), fileId: 'file_copy', fromMemory };
      },
    }),
  });
  try {
    engine.execute('demo.rename', { name: 'Copied live state' });
    const before = engine.snapshot();
    const projectId = store.files.get(path)!.projectId;
    expect(await projects.copy({ dest: 'Copy.pcbk', identity: 'same' })).toMatchObject({
      ok: true,
      value: { projectId, fileId: 'file_copy', fromMemory },
    });
    expect(engine.snapshot().doc).toBe(before.doc);
    expect(engine.snapshot().history).toEqual(before.history);
    expect(await projects.open({ path: 'Copy.pcbk' })).toMatchObject({
      ok: true,
      value: { fileId: 'file_copy' },
    });
  } finally {
    await projects.discard();
  }
});
