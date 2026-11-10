import { useSnapshot } from '@pcbk/client';
import { selectComponents } from '../contract';
import { ComponentList } from './ComponentList';
import { placementEt } from './i18n/et';

export function PlacedList() {
  const components = useSnapshot(selectComponents)
    .filter((component) => component.board)
    .sort((a, b) => a.ref.localeCompare(b.ref, 'et', { numeric: true }));
  return components.length ? (
    <ComponentList components={components} />
  ) : (
    <p className="pcbk-components__empty">
      {placementEt.placed.emptyBefore}
      <strong>{placementEt.tabs.library}</strong>
      {placementEt.placed.emptyAfter}
    </p>
  );
}
