import type { PhotoRef } from '@pcbk/domain';
import type { PhotoStore } from '@pcbk/engine';
import { storageError } from './storage-tauri';

export type PhotoInvoke = <T>(
  command: string,
  args?: Record<string, unknown> | ArrayBuffer,
  options?: { headers: Record<string, string> },
) => Promise<T>;

export function createTauriPhotoStore({
  invoke,
  platform = typeof navigator === 'undefined' ? '' : navigator.platform,
}: {
  invoke: PhotoInvoke;
  platform?: string;
}): PhotoStore {
  async function call<T>(...args: Parameters<PhotoInvoke>): Promise<T> {
    try {
      return await invoke<T>(...args);
    } catch (error) {
      throw storageError(error);
    }
  }
  return {
    importPath(session, path, id) {
      return call<PhotoRef>('photo_import_path', { session, path, id });
    },
    importBytes(session, bytes, id, name) {
      return call<PhotoRef>('photo_import_bytes', bytes, {
        headers: {
          'x-photo-session': encodeURIComponent(session),
          'x-photo-id': encodeURIComponent(id),
          'x-photo-name': encodeURIComponent(name),
        },
      });
    },
    prune(session, keep) {
      return call<void>('photo_prune', { session, keep });
    },
    url(session, id, variant) {
      const origin = /^win/i.test(platform) ? 'http://pcbk.localhost' : 'pcbk://localhost';
      return `${origin}/photo/${encodeURIComponent(session)}/${encodeURIComponent(id)}?v=${variant}`;
    },
  };
}
