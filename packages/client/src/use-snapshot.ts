import { useMemo, useSyncExternalStore } from 'react';
import type { Snapshot } from '@pcbk/contracts';
import { useEngine } from './context';
import { newestSnapshot } from './session-filter';

export function useSnapshot<T>(select: (snapshot: Snapshot) => T): T {
  const engine = useEngine();
  const source = useMemo(() => {
    let accepted: Snapshot | undefined;
    const read = () => {
      accepted = newestSnapshot(accepted, engine.snapshot());
      return accepted;
    };
    return { read, subscribe: (notify: () => void) => engine.subscribe(notify) };
  }, [engine]);
  const snapshot = useSyncExternalStore(source.subscribe, source.read, source.read);
  // Select after reading the stable raw snapshot: object selectors cannot cause a read loop.
  return useMemo(() => select(snapshot), [snapshot, select]);
}
