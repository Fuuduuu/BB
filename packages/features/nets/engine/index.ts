import type { EngineModule } from '@pcbk/engine';

export const netsEngine: EngineModule = {
  id: 'nets',
  owns: ['netLabels', 'roles'],
};
