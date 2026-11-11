import { componentEt } from './i18n/et';
import type { ReactNode } from 'react';
import type { Snapshot } from '@pcbk/contracts';
import { useSessionStore } from '@pcbk/ui';

type ListedComponent = Snapshot['doc']['components'][number];

export function ComponentList({
  components,
  renderActions,
}: {
  components: readonly ListedComponent[];
  renderActions?(component: ListedComponent): ReactNode;
}) {
  const selection = useSessionStore((s) => s.selection);
  return (
    <ul className="pcbk-components__list">
      {components.map((component) => (
        <li key={component.id}>
          <button
            type="button"
            className="pcbk-component-row"
            aria-label={componentEt.select(component.ref)}
            aria-pressed={selection.items.some(
              (item) =>
                (item.kind === 'component' && item.id === component.id) ||
                (item.kind === 'pin' && item.componentId === component.id),
            )}
            onClick={() =>
              useSessionStore
                .getState()
                .setSelection({ items: [{ kind: 'component', id: component.id }] })
            }
          >
            <span className="pcbk-component-row__ref bb-mono">{component.ref}</span>
            <span className="pcbk-component-row__body">
              <span>{componentEt.kinds[component.kind]}</span>
              <span className="pcbk-component-row__value bb-mono">{component.value}</span>
            </span>
          </button>
          {renderActions?.(component)}
        </li>
      ))}
    </ul>
  );
}
