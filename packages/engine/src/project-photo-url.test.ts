import { expect, test, vi } from 'vitest';
import { projectSetup } from './__tests__/project-helpers';

test('photo_url_uses_active_storage_session', async () => {
  const sessions: string[] = [];
  const url = vi.fn(
    (session: string, id: string, variant: string) => `${session}/${id}/${variant}`,
  );
  const { projects, host, path } = await projectSetup({
    create: false,
    photos: { url },
    wrap: (repo) => ({
      ...repo,
      async create(req) {
        const opened = await repo.create(req);
        sessions.push(opened.session);
        return opened;
      },
      async open(path) {
        const opened = await repo.open(path);
        sessions.push(opened.session);
        return opened;
      },
      async copy(req) {
        const opened = await repo.copy(req);
        sessions.push(opened.session);
        return opened;
      },
    }),
  });
  expect(projects.photoUrl).toBeTypeOf('function');
  expect(projects.photoUrl('pho_1', 'display')).toBeNull();
  expect(url).not.toHaveBeenCalled();
  expect((await projects.create({ name: 'Foto', path })).ok).toBe(true);
  const engineSession = host.current()!.sessionId;
  expect(sessions[0]).not.toBe(engineSession);
  expect(projects.photoUrl('pho_1', 'display')).toBe(`${sessions[0]}/pho_1/display`);
  expect(url).toHaveBeenLastCalledWith(sessions[0], 'pho_1', 'display');

  expect((await projects.copy({ dest: 'copied.pcbk', identity: 'same' })).ok).toBe(true);
  expect(host.current()!.sessionId).toBe(engineSession);
  expect(sessions[1]).not.toBe(sessions[0]);
  expect(projects.photoUrl('pho_1', 'original')).toBe(`${sessions[1]}/pho_1/original`);
  expect(url).toHaveBeenLastCalledWith(sessions[1], 'pho_1', 'original');
  expect((await projects.open({ path: 'missing.pcbk' })).ok).toBe(false);
  expect(projects.photoUrl('pho_1', 'display')).toBe(`${sessions[1]}/pho_1/display`);

  expect((await projects.close()).ok).toBe(true);
  const calls = url.mock.calls.length;
  expect(projects.photoUrl('pho_1', 'display')).toBeNull();
  expect(url).toHaveBeenCalledTimes(calls);
  expect((await projects.open({ path })).ok).toBe(true);
  expect(projects.photoUrl('pho_1', 'display')).toBe(`${sessions[2]}/pho_1/display`);
  await projects.close();
});
