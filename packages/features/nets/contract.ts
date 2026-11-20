import { EndRefSchema, IdSchema, NetRoleSchema } from '@pcbk/domain';
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
