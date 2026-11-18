import { expect, test } from 'vitest';
import type { TauriInvoke } from '@pcbk/adapters';
import { newBoardDoc } from '@pcbk/domain';

import { measureProjectIpc } from './ipc-timing';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('probe times project_open and project_save only until the real invoke resolves', async () => {
  const doc = newBoardDoc('I/O timing');
  doc.rev = 8;
  const open = deferred<unknown>();
  const save = deferred<unknown>();
  const saving = deferred<void>();
  const calls: { command: string; args: Record<string, unknown> | undefined }[] = [];
  let now = 10;
  const invoke: TauriInvoke = async <T>(command: string, args?: Record<string, unknown>) => {
    calls.push({ command, args });
    if (command === 'project_open') return (await open.promise) as T;
    if (command === 'recent_add') now = 40;
    if (command === 'project_save') {
      saving.resolve();
      return (await save.promise) as T;
    }
    if (command === 'project_close') now = 100;
    return undefined as T;
  };

  const pending = measureProjectIpc('synthetic.pcbk', invoke, () => now);
  now = 26;
  open.resolve({
    session: 'storage-session',
    project_id: 'project-id',
    file_id: 'file-id',
    path: 'synthetic.pcbk',
    doc_json: JSON.stringify(doc),
    view_json: null,
    format_version: doc.format_version,
    read_only: false,
  });
  await saving.promise;
  now = 65;
  save.resolve(undefined);

  await expect(pending).resolves.toEqual([
    { command: 'project_open', elapsedMs: 16 },
    { command: 'project_save', elapsedMs: 25 },
  ]);
  expect(calls.map(({ command }) => command)).toEqual([
    'project_open',
    'recent_add',
    'project_save',
    'project_close',
  ]);
  expect(calls[2]?.args).toMatchObject({
    session: 'storage-session',
    base_rev: 8,
    rev: 8,
    doc_json: JSON.stringify(doc),
    journal: [],
  });
});
