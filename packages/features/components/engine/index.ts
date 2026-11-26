import type { EngineModule } from '@pcbk/engine';
import { commands } from './commands';
import { componentPlacementDerivations } from './derive';
import { scaleFromPinsCommand } from './scale-from-pins';

export const componentsEngine: EngineModule = {
  id: 'components',
  owns: ['components'],
  commands: [...commands, scaleFromPinsCommand],
  derive: componentPlacementDerivations,
};
