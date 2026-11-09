import type { EngineModule } from '@pcbk/engine';
import { commands } from './commands';

export const componentsEngine: EngineModule = {
  id: 'components',
  owns: ['components'],
  commands,
};
