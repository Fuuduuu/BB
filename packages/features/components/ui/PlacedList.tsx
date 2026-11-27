import { useSnapshot } from '@pcbk/client';
import { selectComponents } from '../contract';
import { ComponentList } from './ComponentList';
import { placementEt } from './i18n/et';
import { isPlacedOnSchematic } from './placement';

export function PlacedList({ schematic = false }: { schematic?: boolean }) {
  const components = useSnapshot(selectComponents)
    .filter((component) => (schematic ? isPlacedOnSchematic(component) : component.board))
    .sort((a, b) => a.ref.localeCompare(b.ref, 'et', { numeric: true }));
  return components.length ? (
    <ComponentList components={components} />
  ) : schematic ? null : (
    <p className="pcbk-components__empty">
      {placementEt.placed.emptyBefore}
      <strong>{placementEt.tabs.library}</strong>
      {placementEt.placed.emptyAfter}
    </p>
  );
}
