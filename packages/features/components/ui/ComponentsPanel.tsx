import { useRef } from 'react';
import { useSnapshot } from '@pcbk/client';
import type { IdGen } from '@pcbk/contracts';
import { useViewStore } from '@pcbk/ui';
import { readComponentsView } from './components-view';
import { placementEt } from './i18n/et';
import { PlacedList } from './PlacedList';
import { isPlacedOnSchematic } from './placement';
import { UnplacedList } from './UnplacedList';

const filters = ['placed', 'unplaced'] as const;

export function ComponentsPanel({ ids }: { ids: IdGen }) {
  const snapshot = useSnapshot((current) => current);
  const rawView = useViewStore((store) => store.modules.components);
  const schematic = useViewStore((store) => store.activeView === 'schematic');
  const { filter } = readComponentsView(rawView);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const counts = {
    placed: snapshot.doc.components.filter((component) =>
      schematic ? isPlacedOnSchematic(component) : component.board,
    ).length,
    unplaced: (schematic ? snapshot.derived.unplacedSchematic : snapshot.derived.unplacedBoard)
      .length,
  };

  function changeFilter(next: (typeof filters)[number]) {
    useViewStore.getState().setModuleView('components', { filter: next });
  }

  return (
    <>
      <div
        className="pcbk-component-filters"
        role="radiogroup"
        aria-label={placementEt.filter.label}
      >
        {filters.map((option, index) => (
          <button
            key={option}
            ref={(button) => {
              buttons.current[index] = button;
            }}
            className="pcbk-component-filters__option"
            type="button"
            role="radio"
            aria-checked={filter === option}
            tabIndex={filter === option ? 0 : -1}
            onClick={() => changeFilter(option)}
            onKeyDown={(event) => {
              let next: number;
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
                next = (index + 1) % filters.length;
              else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
                next = (index + filters.length - 1) % filters.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = filters.length - 1;
              else return;
              event.preventDefault();
              changeFilter(filters[next]!);
              buttons.current[next]?.focus();
            }}
          >
            {placementEt.filter[schematic && option === 'placed' ? 'schematic' : option]} (
            {counts[option]})
            {option === 'unplaced' && filter === 'placed' && counts.unplaced > 0 && (
              <span className="pcbk-component-filters__dot" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      {filter === 'placed' ? (
        <PlacedList schematic={schematic} />
      ) : (
        <UnplacedList ids={ids} schematic={schematic} />
      )}
    </>
  );
}
