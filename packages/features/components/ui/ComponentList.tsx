import { componentEt } from './i18n/et';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Snapshot } from '@pcbk/contracts';
import { useSessionStore } from '@pcbk/ui';
import { useHoverStore } from './hover-store';

type ListedComponent = Snapshot['doc']['components'][number];

export function ComponentList({
  components,
  renderActions,
}: {
  components: readonly ListedComponent[];
  renderActions?(component: ListedComponent): ReactNode;
}) {
  const selection = useSessionStore((s) => s.selection);
  const previewed = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (previewed.current !== null) useHoverStore.getState().clear(previewed.current);
    },
    [],
  );
  useEffect(() => {
    const id = previewed.current;
    if (id !== null && !components.some((component) => component.id === id)) {
      previewed.current = null;
      useHoverStore.getState().clear(id);
    }
  }, [components]);

  function showPreview(id: string) {
    previewed.current = id;
    useHoverStore.getState().setComponentId(id);
  }

  function clearPreview(id: string) {
    if (previewed.current === id) previewed.current = null;
    useHoverStore.getState().clear(id);
  }

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
            onPointerEnter={() => showPreview(component.id)}
            onPointerLeave={() => clearPreview(component.id)}
            onFocus={() => showPreview(component.id)}
            onBlur={() => clearPreview(component.id)}
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
