import { BoardDocSchema } from '@pcbk/domain';
import type { DocKey } from '@pcbk/domain';
import type { CommandSpec, DeriveSpec, EngineModule } from './types';

export class RegistryError extends Error {
  override name = 'RegistryError';
}
export type RegisteredCommand = { spec: CommandSpec<unknown>; fields: ReadonlySet<DocKey> };

export function buildRegistry(modules: EngineModule[], reserved: DocKey[] = []) {
  const commands = new Map<string, RegisteredCommand>();
  const byId = new Map<string, EngineModule>();
  const derive: DeriveSpec[] = [];
  const deriveKeys = new Set<string>();
  const owners = new Map<DocKey, string>([
    ['rev', 'core'],
    ['format_version', 'core'],
  ]);
  const knownFields = BoardDocSchema.keyof().options;
  const checkField = (field: DocKey) => {
    if (!Object.hasOwn(BoardDocSchema.shape, field))
      throw new RegistryError(`Unknown document field: ${field}`);
  };
  const claim = (field: DocKey, owner: string) => {
    checkField(field);
    if (owners.has(field)) throw new RegistryError(`Multiple owners for field: ${field}`);
    owners.set(field, owner);
  };
  for (const field of reserved) claim(field, 'reserved');
  for (const module of modules) {
    if (!module.id || byId.has(module.id))
      throw new RegistryError(`Duplicate or empty module: ${module.id}`);
    byId.set(module.id, module);
    for (const field of module.owns ?? []) claim(field, module.id);
  }
  for (const field of knownFields) {
    if (!owners.has(field)) throw new RegistryError(`Unowned document field: ${field}`);
  }
  const ordered: EngineModule[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new RegistryError(`Dependency cycle: ${id}`);
    if (visited.has(id)) return;
    const module = byId.get(id);
    if (!module) throw new RegistryError(`Missing module dependency: ${id}`);
    visiting.add(id);
    for (const dependency of module.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
    ordered.push(module);
  };
  for (const module of modules) visit(module.id);
  for (const module of ordered) {
    for (const command of module.commands ?? []) {
      if (commands.has(command.id)) throw new RegistryError(`Duplicate command: ${command.id}`);
      for (const field of command.alsoWrites ?? []) checkField(field);
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
