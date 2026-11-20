export class RuleRejected extends Error {
  override name = 'RuleRejected';

  constructor(readonly reason: string) {
    super(reason);
  }
}

export class RuleTargetNotFound extends Error {
  override name = 'RuleTargetNotFound';

  constructor(readonly id: string) {
    super(`Rule target not found: ${id}`);
  }
}
