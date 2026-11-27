import type { EngineModule } from '@pcbk/engine';

export const schematicEngine: EngineModule = { id: 'schematic', dependsOn: ['components'] };
