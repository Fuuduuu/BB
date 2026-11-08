// Shared with feature contracts; generating identities never needs an engine import.
export interface IdGen {
  newId(prefix: string): string;
}
