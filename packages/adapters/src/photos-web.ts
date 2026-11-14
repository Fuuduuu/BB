import type { PhotoRef } from '@pcbk/domain';
import type { PhotoStore } from '@pcbk/engine';
import { StorageError } from '@pcbk/engine';
import { entries, promisifyRequest } from 'idb-keyval';
import type { UseStore } from 'idb-keyval';
import { orientationTransform, readExifOrientation } from './exif';
import { decodeImage, imageHeader } from './photo-image';
import { createWebStore } from './web-db';

type Variant = 'display' | 'original';
type StoredPhoto = { mime: string; width: number; height: number; bytes: Blob };
type Session = { projectId: string; urls: Map<string, string> };

export function createWebPhotoStore(options: { store?: UseStore } = {}): {
  photos: PhotoStore;
  prepare(session: string, projectId: string): Promise<void>;
  release(session: string): void;
} {
  const store = options.store ?? createWebStore('photos');
  const sessions = new Map<string, Session>();
  const getSession = (id: string): Session => {
    const session = sessions.get(id);
    if (!session) throw new StorageError('missing');
    return session;
  };
  const release = (id: string) => {
    for (const url of sessions.get(id)?.urls.values() ?? []) URL.revokeObjectURL(url);
    sessions.delete(id);
  };
  const cache = (session: Session, key: string, photo: StoredPhoto) => {
    const previous = session.urls.get(key);
    if (previous) URL.revokeObjectURL(previous);
    session.urls.set(key, URL.createObjectURL(photo.bytes));
  };
  async function guard<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof StorageError) throw error;
      if (error instanceof DOMException && error.name === 'QuotaExceededError')
        throw new StorageError('disk_full');
      if (
        error instanceof DOMException &&
        ['SecurityError', 'NotAllowedError', 'ReadOnlyError'].includes(error.name)
      )
        throw new StorageError('read_only');
      throw new StorageError('unknown');
    }
  }
  return {
    async prepare(id, projectId) {
      await guard(async () => {
        const session: Session = { projectId, urls: new Map() };
        try {
          for (const [key, photo] of await entries<IDBValidKey, StoredPhoto>(store)) {
            if (typeof key === 'string' && key.startsWith(`${projectId}/`))
              cache(session, key, photo);
          }
          release(id);
          sessions.set(id, session);
        } catch (error) {
          for (const url of session.urls.values()) URL.revokeObjectURL(url);
          throw error;
        }
      });
    },
    release,
    photos: {
      async importPath() {
        throw new StorageError('unknown');
      },
      importBytes(id, bytes, photoId, name) {
        const captured = bytes.slice(0);
        return guard(async () => {
          const session = getSession(id);
          const header = imageHeader(captured);
          const original: StoredPhoto = {
            ...header,
            bytes: new Blob([captured], { type: header.mime }),
          };
          const bitmap = await decodeImage(original.bytes);
          let display: StoredPhoto | undefined;
          try {
            if (
              bitmap &&
              header.width * header.height > 12_000_000 &&
              typeof OffscreenCanvas === 'function'
            ) {
              const scale = Math.min(
                Math.sqrt(12_000_000 / (header.width * header.height)),
                12_000_000 / header.width,
                12_000_000 / header.height,
              );
              const width = Math.max(1, Math.floor(header.width * scale));
              const height = Math.max(1, Math.floor(header.height * scale));
              const canvas = new OffscreenCanvas(width, height);
              const context = canvas.getContext('2d');
              if (context && typeof canvas.convertToBlob === 'function') {
                context.drawImage(bitmap, 0, 0, width, height);
                const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
                if (blob.type === 'image/jpeg')
                  display = { mime: blob.type, width, height, bytes: blob };
              }
            }
          } catch (error) {
            if (!(error instanceof DOMException && error.name === 'NotSupportedError')) throw error;
          } finally {
            bitmap?.close();
          }
          const prefix = `${session.projectId}/${photoId}/`;
          await store('readwrite', (rows) => {
            if (getSession(id) !== session) throw new StorageError('missing');
            try {
              rows.add(original, `${prefix}original`);
              if (display) rows.add(display, `${prefix}display`);
            } catch (error) {
              rows.transaction.abort();
              throw error;
            }
            return promisifyRequest(rows.transaction);
          });
          for (const current of sessions.values()) {
            if (current.projectId !== session.projectId) continue;
            cache(current, `${prefix}original`, original);
            if (display) cache(current, `${prefix}display`, display);
          }
          const ref: PhotoRef = {
            id: photoId,
            side: 'top',
            name,
            widthPx: header.width,
            heightPx: header.height,
            transform: orientationTransform(readExifOrientation(captured)),
          };
          return ref;
        });
      },
      // Without a browser writer lock, other windows' pending imports must survive.
      prune: async () => undefined,
      url(id, photoId, variant: Variant) {
        const session = getSession(id);
        const prefix = `${session.projectId}/${photoId}/`;
        const url =
          session.urls.get(`${prefix}${variant}`) ?? session.urls.get(`${prefix}original`);
        if (!url) throw new StorageError('missing');
        return url;
      },
    },
  };
}
