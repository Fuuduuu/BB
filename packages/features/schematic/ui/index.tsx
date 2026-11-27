import type { UiModule } from '@pcbk/ui';
import { symbolLayer } from './symbol-layer';

export function createSchematicUi(): UiModule {
  return { id: 'schematic', title: 'Skeem', schematicLayers: [symbolLayer] };
}
