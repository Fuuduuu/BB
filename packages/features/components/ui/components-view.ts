export interface ComponentsView {
  filter: 'placed' | 'unplaced';
}

export function readComponentsView(value: unknown): ComponentsView {
  const fields =
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return { filter: fields.filter === 'unplaced' ? 'unplaced' : 'placed' };
}
