import type { EngineModule } from '@pcbk/engine';
import { commands } from './commands';

export const photoEngine: EngineModule = {
  id: 'photo',
  owns: ['photos', 'activePhotoId', 'scale'],
  commands,
};
