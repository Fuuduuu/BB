import type { IdGen } from '@pcbk/contracts';
import type { UiModule } from '@pcbk/ui';
import { ComponentDetails } from './ComponentDetails';
import { ComponentsPanel } from './ComponentsPanel';
import { PinCard } from './PinCard';
import { Library } from './Library';
import { createPlaceToolSpec } from './PlaceTool';
import { PlacementSection, placementKeys } from './PlacementSection';
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
      {
        id: 'components',
        title: placementEt.tabs.components,
        order: 1,
        summary: (snapshot) =>
          placementEt.summary(
            snapshot.doc.components.filter((component) => component.board).length,
            snapshot.derived.unplacedBoard.length,
          ),
        render: () => <ComponentsPanel ids={ids} />,
      },
    ],
    contextSections: [
      {
        id: 'component',
        order: 0,
        appliesTo: ['component', 'pin'],
        render: ({ selection }) => {
          const [item] = selection.items;
          if (item?.kind === 'pin' && item.componentId) {
            return <PinCard componentId={item.componentId} pinId={item.id} />;
          }
          return item?.kind === 'component' ? (
            <ComponentDetails key={item.id} id={item.id} ids={ids} />
          ) : null;
        },
      },
      {
        id: 'component-placement',
        order: 20,
        appliesTo: ['component'],
        render: ({ selection }) => {
          const [item] = selection.items;
          return item ? <PlacementSection key={item.id} id={item.id} ids={ids} /> : null;
        },
      },
    ],
  };
}
