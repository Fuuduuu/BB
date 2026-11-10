import type { EngineModule } from '@pcbk/engine';
import { commands } from './commands';
import { pinReadingsDerive } from './derive';

export const measurementsEngine: EngineModule = {
  id: 'measurements',
  dependsOn: ['components'],
  owns: ['measurements'],
  commands,
  derive: [pinReadingsDerive],
};
