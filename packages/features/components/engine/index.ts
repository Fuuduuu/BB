import type { EngineModule } from '@pcbk/engine';
import { commands } from './commands';
import { componentPlacementDerivations } from './derive';

export const componentsEngine: EngineModule = {
  id: 'components',
  owns: ['components'],
  commands,
  derive: componentPlacementDerivations,
};
