import type { UiModule } from '@pcbk/ui';
import { schematicEt } from './i18n/et';
import { schematicContextMenu, schematicKeys } from './schematic-actions';
import { symbolLayer } from './symbol-layer';

export function createSchematicUi(): UiModule {
  return {
    id: 'schematic',
    title: schematicEt.title,
    schematicLayers: [symbolLayer],
    schematicKeys,
    schematicContextMenu,
  };
}
