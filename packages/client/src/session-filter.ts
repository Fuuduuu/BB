import type { Snapshot } from '@pcbk/contracts';

export function isCurrentSession(active: string, incoming: string): boolean {
  return active !== '' && incoming === active;
}
export function newestSnapshot(previous: Snapshot | undefined, incoming: Snapshot): Snapshot {
  if (previous && previous.sessionId === incoming.sessionId && incoming.rev <= previous.rev)
    return previous;
  return incoming;
}
