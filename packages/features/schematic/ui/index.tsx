import type { UiModule } from '@pcbk/ui';
import { schematicEt } from './i18n/et';
import { PinFunction } from './PinFunction';
import { showOnBoard, showOnSchematic } from './reveal-actions';
import { schematicContextMenu, schematicKeys } from './schematic-actions';
import { symbolLayer } from './symbol-layer';

export function createSchematicUi(): UiModule {
  return {
    id: 'schematic',
    title: schematicEt.title,
    contextSections: [
      {
        id: 'schematic.pin-function',
        order: 10,
        appliesTo: ['component'],
        render: ({ selection }) => {
          const [item] = selection.items;
          return selection.items.length === 1 && item?.kind === 'component' ? (
            <PinFunction id={item.id} />
          ) : null;
        },
      },
    ],
    schematicLayers: [symbolLayer],
    schematicKeys,
    contextMenu: [showOnSchematic],
    schematicContextMenu: [...schematicContextMenu, showOnBoard],
  };
}
