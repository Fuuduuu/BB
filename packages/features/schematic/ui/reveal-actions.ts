import type { Snapshot } from '@pcbk/contracts';
import { useViewStore } from '@pcbk/ui';
import type { ContextMenuItemSpec, Selection, SelectionItem } from '@pcbk/ui';
import { schematicEt } from './i18n/et';

type View = 'board' | 'schematic';

function positionIn(snapshot: Snapshot, item: SelectionItem | undefined, view: View) {
  if (item?.kind !== 'component') return undefined;
  const component = snapshot.doc.components.find(({ id }) => id === item.id);
  return view === 'board' ? component?.board?.center : component?.schematic?.at;
}

function firstPositionIn(snapshot: Snapshot, selection: Selection, view: View) {
  for (const item of selection.items) {
    const point = positionIn(snapshot, item, view);
    if (point) return point;
  }
}

function revealAction(view: View, id: string, title: string, order: number): ContextMenuItemSpec {
  return {
    id,
    order,
    appliesTo: ['component'],
    label: () => title,
    available: (snapshot, selection) => Boolean(firstPositionIn(snapshot, selection, view)),
    run(api, selection, _at, target) {
      const snapshot = api.snapshot();
      const point =
        positionIn(snapshot, target, view) ?? firstPositionIn(snapshot, selection, view);
      if (!point) return false;
      api.select(selection);
      const { setActiveView, requestReveal } = useViewStore.getState();
      setActiveView(view);
      requestReveal(view, point);
      return true;
    },
  };
}

export const showOnSchematic = revealAction(
  'schematic',
  'schematic.showOnSchematic',
  schematicEt.showOnSchematic,
  50,
);

export const showOnBoard = revealAction(
  'board',
  'schematic.showOnBoard',
  schematicEt.showOnBoard,
  4,
);
