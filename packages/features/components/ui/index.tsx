import type { IdGen } from '@pcbk/contracts';
import type { UiModule } from '@pcbk/ui';
import { ComponentDetails } from './ComponentDetails';
import { Library } from './Library';
import { createPlaceToolSpec } from './PlaceTool';
import { PlacementSection, placementKeys } from './PlacementSection';
import { PlacedList } from './PlacedList';
import { UnplacedList } from './UnplacedList';
import { componentEt, placementEt } from './i18n/et';
import { COMPONENTS_LAYERS } from './layers';
import { usePlaceStore } from './place-store';
import './components.css';

export function createComponentsUi(ids: IdGen): UiModule {
  return {
    id: 'components',
    title: componentEt.title,
    canvasLayers: COMPONENTS_LAYERS,
    tools: [createPlaceToolSpec(ids)],
    keys: placementKeys,
    onSessionReset: () => usePlaceStore.getState().reset(),
    navigatorTabs: [
      { id: 'library', title: placementEt.tabs.library, order: 0, render: () => <Library /> },
      { id: 'components', title: placementEt.tabs.placed, order: 1, render: () => <PlacedList /> },
      {
        id: 'unplaced',
        title: placementEt.tabs.unplaced,
        order: 2,
        count: (snapshot) => snapshot.derived.unplacedBoard.length,
        render: () => <UnplacedList ids={ids} />,
      },
    ],
    contextSections: [
      {
        id: 'component',
        order: 0,
        appliesTo: ['component', 'pin'],
        render: ({ selection }) => {
          const [item] = selection.items;
          const id = item?.kind === 'component' ? item.id : item?.componentId;
          return id ? <ComponentDetails key={id} id={id} ids={ids} /> : null;
        },
      },
      {
        id: 'component-placement',
        order: 20,
        appliesTo: ['component'],
        render: ({ selection }) => {
          const [item] = selection.items;
          return item ? <PlacementSection key={item.id} id={item.id} /> : null;
        },
      },
    ],
  };
}
