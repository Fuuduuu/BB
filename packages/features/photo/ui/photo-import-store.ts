import { create } from 'zustand';
import type { DocumentEngine, EngineError, ProjectService } from '@pcbk/contracts';
import { et } from '@pcbk/ui';
import { addPhoto } from './add-photo';
import { photoEt as text } from './i18n/et';

interface ImportFeedback {
  sessionId: string;
  busy: boolean;
  error: string | null;
}

const initial: ImportFeedback = { sessionId: '', busy: false, error: null };
export const usePhotoImportStore = create<ImportFeedback>(() => initial);
let generation = 0;
let queues = new WeakMap<
  DocumentEngine,
  { sessionId: string; tail: Promise<void>; pending: number }
>();

export function resetPhotoImports() {
  generation++;
  queues = new WeakMap();
  usePhotoImportStore.setState(initial);
}

function importError(error: EngineError): string {
  if (
    error.code === 'validation' &&
    error.issues.some(({ message }) => message === 'photo_limit')
  ) {
    return text.photoLimit;
  }
  const reason =
    error.code === 'storage'
      ? et.reason[error.reason]
      : error.code === 'read_only'
        ? text.readOnly
        : et.common.actionFailed;
  return text.addFailed(reason);
}

export function queuePhotoImport(
  file: File | null,
  context: { engine: DocumentEngine; projects: ProjectService },
) {
  const { engine } = context;
  const sessionId = engine.snapshot().sessionId;
  const currentGeneration = generation;
  const current = () =>
    generation === currentGeneration && engine.snapshot().sessionId === sessionId;
  if (!file) {
    usePhotoImportStore.setState({ sessionId, error: text.dropHint });
    return;
  }
  let queue = queues.get(engine);
  if (!queue || queue.sessionId !== sessionId) {
    queue = { sessionId, tail: Promise.resolve(), pending: 0 };
    queues.set(engine, queue);
  }
  const active = queue;
  active.pending++;
  usePhotoImportStore.setState({ sessionId, busy: true, error: null });
  active.tail = active.tail
    .then(async () => {
      if (!current()) return;
      const result = await addPhoto(file, context);
      if (!current()) return;
      usePhotoImportStore.setState({
        sessionId,
        error:
          result.ok || result.error.code === 'stale_session' ? null : importError(result.error),
      });
    })
    .finally(() => {
      active.pending--;
      if (current()) usePhotoImportStore.setState({ busy: active.pending > 0 });
    });
}
