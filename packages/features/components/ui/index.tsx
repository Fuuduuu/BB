import type { IdGen, Snapshot } from '@pcbk/contracts';
import { useSessionStore, useViewStore } from '@pcbk/ui';
import type { ContextMenuItemSpec, Selection, UiModule } from '@pcbk/ui';
import { selectComponent } from '../contract';
import { alignToolSpec } from './AlignTool';
import { useAlignStore } from './align-store';
import { ComponentDetails } from './ComponentDetails';
import { ComponentsPanel } from './ComponentsPanel';
import { useHoverStore } from './hover-store';
import { PinCard, usePinNameFocus } from './PinCard';
import { Library } from './Library';
import { OwnPinHint } from './OwnPinHint';
import { OWN_PIN_TOOL_ID, ownPinToolSpec, useOwnPinError } from './OwnPinTool';
import { createPlaceToolSpec, openPlacementAt } from './PlaceTool';
import {
  flipSide,
  PlacementSection,
  placementKeys,
  removePlacements,
  rotateClockwise,
  rotateCounterclockwise,
} from './PlacementSection';
import { componentEt, placementEt } from './i18n/et';
import { COMPONENTS_LAYERS } from './layers';
import { ALIGN_LAYER, AlignHint } from './layers/AlignLayer';
import { HOVER_LAYER } from './layers/HoverLayer';
import { usePlaceStore } from './place-store';
import './components.css';

function firstSelectedPin(snapshot: Snapshot, selection: Selection) {
  const item = selection.items.find(({ kind }) => kind === 'pin');
  const componentId = item?.componentId;
  if (!item || !componentId) return undefined;
  const component = selectComponent(snapshot, componentId);
  const pin = component?.pins.find(({ id }) => id === item.id);
  return pin ? { item, componentId, pin } : undefined;
}

const contextMenu: ContextMenuItemSpec[] = [
  {
    id: 'components.rotateClockwise',
    appliesTo: ['component'],
    order: 10,
    label: () => placementEt.section.rotateClockwise,
    shortcut: { key: 'R' },
    run: rotateClockwise,
  },
  {
    id: 'components.rotateCounterclockwise',
    appliesTo: ['component'],
    order: 20,
    label: () => placementEt.section.rotateCounterclockwise,
    shortcut: { key: 'R', shift: true },
    run: rotateCounterclockwise,
  },
  {
    id: 'components.flipSide',
    appliesTo: ['component'],
    order: 30,
    label: () => placementEt.section.flip,
    shortcut: { key: 'F' },
    run: flipSide,
  },
  {
    id: 'components.removeFromBoard',
    appliesTo: ['component'],
    order: 40,
    label: () => placementEt.section.remove,
    run: removePlacements,
  },
  {
    id: 'components.renamePin',
    appliesTo: ['pin'],
    order: 20,
    label: () => componentEt.renamePin,
    run: (api, selection) => {
      const target = firstSelectedPin(api.snapshot(), selection);
      if (!target) return false;
      const { item, pin } = target;
      const current = useSessionStore.getState().selection.items;
      if (current[0] !== item || current.some(({ kind }) => kind !== 'pin')) {
        api.select({ items: [item] });
      }
      useViewStore.getState().setContextOpen(true);
      usePinNameFocus.setState({ requestedUid: pin.uid });
      return true;
    },
  },
  {
    id: 'components.toggleNc',
    appliesTo: ['pin'],
    order: 30,
    label: (snapshot, selection) =>
      firstSelectedPin(snapshot, selection)?.pin.nc ? componentEt.clearNc : componentEt.markNc,
    run: (api, selection) => {
      const target = firstSelectedPin(api.snapshot(), selection);
      if (!target) return false;
      const { componentId, pin } = target;
      return api.execute('components.setNc', { id: componentId, pinId: pin.id, nc: !pin.nc }).ok;
    },
  },
  {
    id: 'components.placeHere',
    appliesTo: ['empty'],
    order: 10,
    label: () => placementEt.addHere,
    run: openPlacementAt,
  },
];

export function createComponentsUi(ids: IdGen): UiModule {
  return {
    id: 'components',
    title: componentEt.title,
    canvasLayers: [...COMPONENTS_LAYERS, HOVER_LAYER, ALIGN_LAYER],
    tools: [createPlaceToolSpec(ids), alignToolSpec(), ownPinToolSpec(ids)],
    keys: placementKeys,
    contextMenu,
    bottomBar: [
      { id: 'components.align', render: () => <AlignHint /> },
      { id: OWN_PIN_TOOL_ID, render: () => <OwnPinHint /> },
    ],
    onSessionReset: () => {
      usePlaceStore.getState().reset();
      useAlignStore.getState().reset();
      useHoverStore.getState().setComponentId(null);
      useOwnPinError.getState().setError(null);
      usePinNameFocus.setState({ requestedUid: null });
    },
    navigatorTabs: [
      {
        id: 'library',
        title: placementEt.tabs.library,
        order: 0,
        render: () => <Library ids={ids} />,
      },
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
    selectionKinds: [
      {
        kind: 'component',
        label: (snapshot, item) => selectComponent(snapshot, item.id)?.ref ?? null,
        exists: (snapshot, item) => selectComponent(snapshot, item.id) !== undefined,
        moveRef: (snapshot, item) =>
          selectComponent(snapshot, item.id)?.board ? { kind: 'component', id: item.id } : null,
      },
      {
        kind: 'pin',
        label: (snapshot, item) => {
          if (!item.componentId) return null;
          const component = selectComponent(snapshot, item.componentId);
          const pin = component?.pins.find(({ id }) => id === item.id);
          return component && pin ? `${component.ref}.${pin.name || pin.id}` : null;
        },
        exists: (snapshot, item) => {
          if (!item.componentId) return false;
          return (
            selectComponent(snapshot, item.componentId)?.pins.some(({ id }) => id === item.id) ??
            false
          );
        },
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
