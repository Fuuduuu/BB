export class CommandTargetNotFound extends Error {
  override name = 'CommandTargetNotFound';

  constructor(readonly id: string) {
    super(`Command target not found: ${id}`);
  }
}

export class CommandRejected extends Error {
  override name = 'CommandRejected';

  constructor(readonly reason: string) {
    super(reason);
  }
}

export function reject(reason: string): never {
  throw new CommandRejected(reason);
}
