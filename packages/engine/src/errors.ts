export class CommandTargetNotFound extends Error {
  override name = 'CommandTargetNotFound';

  constructor(readonly id: string) {
    super(`Command target not found: ${id}`);
  }
}
