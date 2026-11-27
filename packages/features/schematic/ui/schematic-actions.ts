import type { Snapshot } from '@pcbk/contracts';
import type { ContextMenuItemSpec, KeySpec, Selection } from '@pcbk/ui';
import type { SchematicPlaceParams } from '../contract';
import { schematicEt } from './i18n/et';

type Item = SchematicPlaceParams['items'][number];

function selectedPlacements(snapshot: Snapshot, selection: Selection): Item[] {
  const ids = new Set(
    selection.items.filter(({ kind }) => kind === 'component').map(({ id }) => id),
  );
  return snapshot.doc.components.flatMap(({ id, schematic }) => {
    if (!schematic || !ids.has(id)) return [];
    const { at, rot, mirror } = schematic;
    return [{ id, at, rot, mirror }];
  });
}

function changePlacement(change: (item: Item) => Item): KeySpec['run'] {
  return (api, selection) => {
    const items = selectedPlacements(api.snapshot(), selection).map(change);
    if (items.length === 0) return false;
    api.execute('schematic.place', { items });
    return true;
  };
}

const quarterTurns = [0, 90, 180, 270] as const;

function rotate(turns: 1 | 3) {
  return changePlacement((item) => ({
    ...item,
    rot: quarterTurns[(item.rot / 90 + turns) % 4]!,
  }));
}

const rotateClockwise = rotate(1);
const rotateCounterclockwise = rotate(3);
const mirrorPlacement = changePlacement((item) => ({ ...item, mirror: !item.mirror }));

const removePlacement: ContextMenuItemSpec['run'] = (api, selection) => {
  const ids = selectedPlacements(api.snapshot(), selection).map(({ id }) => id);
  if (ids.length === 0) return false;
  api.execute('schematic.remove', { ids });
  return true;
};

const operations = [
  {
    id: 'schematic.rotateClockwise',
    key: 'R',
    title: schematicEt.rotateClockwise,
    run: rotateClockwise,
  },
  {
    id: 'schematic.rotateCounterclockwise',
    key: 'R',
    shift: true,
    title: schematicEt.rotateCounterclockwise,
    run: rotateCounterclockwise,
  },
  { id: 'schematic.mirror', key: 'F', title: schematicEt.mirror, run: mirrorPlacement },
];

export const schematicKeys: KeySpec[] = operations.map(({ id, key, shift, run }) => ({
  id,
  key,
  shift,
  run,
}));

export const schematicContextMenu: ContextMenuItemSpec[] = [
  ...operations.map(({ id, key, shift, title, run }, order) => ({
    id,
    order,
    appliesTo: ['component'],
    label: () => title,
    shortcut: { key, shift },
    run,
  })),
  {
    id: 'schematic.remove',
    order: operations.length,
    appliesTo: ['component'],
    label: () => schematicEt.remove,
    run: removePlacement,
  },
];
