import { BoardDocSchema } from '@pcbk/domain';
import { projectEngine } from '@pcbk/features/project/engine';
import { componentsEngine } from '@pcbk/features/components/engine';

export const engineFeatures = [projectEngine, componentsEngine];
const owned = new Set([
  'rev',
  'format_version',
  ...engineFeatures.flatMap((module) => module.owns ?? []),
]);
// Fields whose features are planned for M1+ are explicitly reserved in M0.
export const reservedFields = BoardDocSchema.keyof().options.filter((key) => !owned.has(key));
