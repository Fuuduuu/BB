import { BoardDocSchema } from '@pcbk/domain';
import type { DocKey } from '@pcbk/domain';
import type { CommandSpec, DeriveSpec, EngineModule } from './types';

export class RegistryError extends Error {
  override name = 'RegistryError';
}
export type RegisteredCommand = { spec: CommandSpec<unknown>; fields: ReadonlySet<DocKey> };

export function buildRegistry(modules: EngineModule[], reserved: DocKey[] = []) {
  const commands = new Map<string, RegisteredCommand>();
  const ids = new Set<string>();
  const derive: DeriveSpec[] = [];
  const deriveKeys = new Set<string>();
  for (const module of modules) {
    if (!module.id || ids.has(module.id))
      throw new RegistryError(`Duplicate or empty module: ${module.id}`);
    ids.add(module.id);
    for (const field of module.owns ?? []) {
      if (!(field in BoardDocSchema.shape) || field === 'rev' || field === 'format_version') {
        throw new RegistryError(`Invalid owned field: ${field}`);
      }
    }
    for (const command of module.commands ?? []) {
      if (commands.has(command.id)) throw new RegistryError(`Duplicate command: ${command.id}`);
      const spec = { ...command, alsoWrites: [...(command.alsoWrites ?? [])] };
      commands.set(command.id, {
        spec,
        fields: new Set([...(module.owns ?? []), ...spec.alsoWrites]),
      });
    }
    for (const spec of module.derive ?? []) {
      if (deriveKeys.has(spec.key)) throw new RegistryError(`Duplicate derivation: ${spec.key}`);
      deriveKeys.add(spec.key);
      derive.push({ ...spec });
    }
  }
  return { commands, derive, reserved: new Set(reserved) };
}
