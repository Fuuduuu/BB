import type { DocumentEngine, EngineError, ProjectService, Result } from '@pcbk/contracts';

type PhotoContext = { engine: DocumentEngine; projects: ProjectService };
const queues = new WeakMap<DocumentEngine, { sessionId: string; tail: Promise<void> }>();

export async function addPhoto(
  file: File,
  context: PhotoContext,
): Promise<Result<void, EngineError>> {
  const { engine } = context;
  const sessionId = engine.snapshot().sessionId;
  const previous = queues.get(engine);
  const tail = previous?.sessionId === sessionId ? previous.tail : Promise.resolve();
  // Home and workspace imports share the entire read/import/command operation.
  const result = tail.then(() => importPhotoFile(file, context, sessionId));
  queues.set(engine, {
    sessionId,
    tail: result.then(
      () => undefined,
      () => undefined,
    ),
  });
  return result;
}

async function importPhotoFile(
  file: File,
  { engine, projects }: PhotoContext,
  sessionId: string,
): Promise<Result<void, EngineError>> {
  const stale = (): Result<void, EngineError> => ({ ok: false, error: { code: 'stale_session' } });
  const limit = (): Result<void, EngineError> => ({
    ok: false,
    error: {
      code: 'validation',
      issues: [{ code: 'custom', path: ['photos'], message: 'photo_limit' }],
    },
  });
  if (engine.snapshot().sessionId !== sessionId) return stale();
  if (engine.snapshot().doc.photos.length > 0) return limit();
  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    if (engine.snapshot().sessionId !== sessionId) return stale();
    return { ok: false, error: { code: 'storage', reason: 'corrupt_image' } };
  }
  if (engine.snapshot().sessionId !== sessionId) return stale();
  if (engine.snapshot().doc.photos.length > 0) return limit();
  try {
    const imported = await projects.importPhoto({ bytes, name: file.name || 'foto.png' });
    if (engine.snapshot().sessionId !== sessionId) return stale();
    if (!imported.ok) return imported;
    const added = engine.execute('photo.add', { photo: imported.value });
    return added.ok ? { ok: true, value: undefined } : added;
  } catch {
    if (engine.snapshot().sessionId !== sessionId) return stale();
    return { ok: false, error: { code: 'storage', reason: 'unknown' } };
  }
}
