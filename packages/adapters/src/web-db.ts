import type { UseStore } from 'idb-keyval';

const databases = new Map<string, Promise<IDBDatabase>>();

/** Version 1 contained projects only; version 2 preserves it and adds photos. */
export function createWebStore(storeName: 'projects' | 'photos', dbName = 'bb-projects'): UseStore {
  function database(): Promise<IDBDatabase> {
    let pending = databases.get(dbName);
    if (!pending) {
      pending = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName, 2);
        request.onupgradeneeded = () => {
          for (const name of ['projects', 'photos']) {
            if (!request.result.objectStoreNames.contains(name))
              request.result.createObjectStore(name);
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const closed = () => {
            databases.delete(dbName);
          };
          db.onclose = closed;
          db.onversionchange = () => {
            db.close();
            closed();
          };
          resolve(db);
        };
      });
      databases.set(dbName, pending);
      pending.catch(() => {
        databases.delete(dbName);
      });
    }
    return pending;
  }
  return async (mode, callback) =>
    callback((await database()).transaction(storeName, mode).objectStore(storeName));
}
