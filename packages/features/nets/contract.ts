import type { Snapshot } from '@pcbk/contracts';
import { EndRefSchema, IdSchema, NetRoleSchema } from '@pcbk/domain';
import type { NetRole } from '@pcbk/domain';
import { pinKey } from '@pcbk/domain/rules';
import type { NetsDerived } from '@pcbk/domain/rules';
import { z } from 'zod';

const NetInfoSchema = z.strictObject({
  key: z.string(),
  members: z.array(z.string()),
  name: z.string(),
  named: z.boolean(),
  roleId: z.string().optional(),
  roleConflict: z.boolean(),
  conflictingRoles: z.array(z.string()),
  beepContradiction: z.boolean(),
});

export const NetsDerivedSchema = z.strictObject({
  list: z.array(NetInfoSchema),
  netOf: z.record(z.string(), z.string()),
  shortedComponents: z.array(z.string()),
});

export const AssignNetSchema = z.strictObject({
  anchor: EndRefSchema,
  labelId: IdSchema,
  name: z.string().optional(),
  roleId: z.string().nullable().optional(),
});
export const JoinNetsSchema = z.strictObject({
  connectionId: IdSchema,
  a: EndRefSchema,
  b: EndRefSchema,
});
export const AddRoleSchema = z.strictObject({ role: NetRoleSchema });
export const UpdateRoleSchema = z.strictObject({
  id: IdSchema,
  label: NetRoleSchema.shape.label.optional(),
  kind: NetRoleSchema.shape.kind.optional(),
  nominalV: NetRoleSchema.shape.nominalV.nullable(),
  color: NetRoleSchema.shape.color.optional(),
});
export const RemoveRoleSchema = z.strictObject({ id: IdSchema });

export type AssignNetParams = z.infer<typeof AssignNetSchema>;
export type JoinNetsParams = z.infer<typeof JoinNetsSchema>;
export type AddRoleParams = z.infer<typeof AddRoleSchema>;
export type UpdateRoleParams = z.infer<typeof UpdateRoleSchema>;
export type RemoveRoleParams = z.infer<typeof RemoveRoleSchema>;

type NetsList = NonNullable<Snapshot['derived']['nets']>['list'];
type Roles = Snapshot['doc']['roles'];
const netInfoCache = new WeakMap<NetsList, Map<string, NetsList[number]>>();
const roleCache = new WeakMap<Roles, Map<string, Roles[number]>>();

function netInfoByKey(list: NetsList) {
  let lookup = netInfoCache.get(list);
  if (!lookup) {
    lookup = new Map(list.map((net) => [net.key, net]));
    netInfoCache.set(list, lookup);
  }
  return lookup;
}

function rolesById(roles: Roles) {
  let lookup = roleCache.get(roles);
  if (!lookup) {
    lookup = new Map(roles.map((role) => [role.id, role]));
    roleCache.set(roles, lookup);
  }
  return lookup;
}

export function roleLabel(roles: Roles, id: string): string {
  return rolesById(roles).get(id)?.label ?? `${id} (puudub)`;
}

export function roleSwatchColor(role: Pick<NetRole, 'id' | 'color'>): string {
  return role.id === 'rol_gnd' ? 'var(--role-gnd)' : role.color;
}

export function netRoleColor(
  { derived: { nets }, doc }: Pick<Snapshot, 'doc' | 'derived'>,
  memberKey: string,
): { color?: string; conflict: boolean } {
  if (!nets || !Object.hasOwn(nets.netOf, memberKey)) return { conflict: false };
  const net = netInfoByKey(nets.list).get(nets.netOf[memberKey]!);
  if (net?.roleConflict) return { conflict: true };
  const role = net?.roleId ? rolesById(doc.roles).get(net.roleId) : undefined;
  return role ? { color: roleSwatchColor(role), conflict: false } : { conflict: false };
}

function csvField(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function netlistCsv({ doc, derived }: Pick<Snapshot, 'doc' | 'derived'>): string {
  const rows = ['Võrk;Roll;Tähis.jalg;Jala nimi'];
  if (!derived.nets?.list.length) return `\uFEFF${rows[0]}`;

  const pins = new Map<string, { ref: string; name: string }>();
  for (const { id, ref, pins: componentPins } of doc.components) {
    for (const pin of componentPins) {
      pins.set(pinKey({ c: id, p: pin.id }), { ref: `${ref}.${pin.id}`, name: pin.name ?? '' });
    }
  }
  const nets = [...derived.nets.list].sort((a, b) => a.name.localeCompare(b.name, 'et'));
  for (const net of nets) {
    const role = net.roleConflict
      ? net.conflictingRoles.map((id) => roleLabel(doc.roles, id)).join(' + ')
      : net.roleId
        ? roleLabel(doc.roles, net.roleId)
        : '';
    for (const member of [...net.members].sort()) {
      const pin = pins.get(member);
      if (pin) rows.push([net.name, role, pin.ref, pin.name].map(csvField).join(';'));
    }
  }
  return `\uFEFF${rows.join('\r\n')}`;
}

declare module '@pcbk/contracts' {
  interface CommandMap {
    'nets.assign': AssignNetParams;
    'nets.join': JoinNetsParams;
    'roles.add': AddRoleParams;
    'roles.update': UpdateRoleParams;
    'roles.remove': RemoveRoleParams;
  }

  interface Derived {
    // An engine can be composed without the nets module.
    nets?: NetsDerived;
  }
}
