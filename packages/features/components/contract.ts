import { ComponentKindSchema, defaultPinIds, IdSchema, PinSchema } from '@pcbk/domain';
import type { ComponentKind } from '@pcbk/domain';
import type { IdGen, Snapshot } from '@pcbk/contracts';
import { z } from 'zod';

const pinIdentity = PinSchema.pick({ id: true, uid: true });
export const AddComponentSchema = z.strictObject({
  id: IdSchema,
  kind: ComponentKindSchema,
  ref: z.string().trim().min(1).optional(),
  pins: z.array(pinIdentity),
  marking: z.string().optional(),
  value: z.string().optional(),
});
export const UpdateComponentSchema = z.strictObject({
  id: IdSchema,
  ref: z.string().trim().min(1).optional(),
  kind: ComponentKindSchema.optional(),
  marking: z.string().optional(),
  value: z.string().optional(),
  note: z.string().optional(),
  dnp: z.boolean().optional(),
  identified: z.boolean().optional(),
});
export const AddPinSchema = z.strictObject({ id: IdSchema, pin: pinIdentity });
export const PinTargetSchema = z.strictObject({ id: IdSchema, pinId: IdSchema });
export const RenamePinSchema = PinTargetSchema.extend({ name: z.string().nullable() });
export const SetNcSchema = PinTargetSchema.extend({ nc: z.boolean() });

export type AddComponentParams = z.infer<typeof AddComponentSchema>;
export type UpdateComponentParams = z.infer<typeof UpdateComponentSchema>;
export type AddPinParams = z.infer<typeof AddPinSchema>;
export type PinTargetParams = z.infer<typeof PinTargetSchema>;
export type RenamePinParams = z.infer<typeof RenamePinSchema>;
export type SetNcParams = z.infer<typeof SetNcSchema>;

declare module '@pcbk/contracts' {
  interface CommandMap {
    'components.add': AddComponentParams;
    'components.update': UpdateComponentParams;
    'components.addPin': AddPinParams;
    'components.renamePin': RenamePinParams;
    'components.setNc': SetNcParams;
    'components.removePin': PinTargetParams;
  }
}

export const selectComponents = (snapshot: Snapshot) => snapshot.doc.components;
export const selectComponent = (snapshot: Snapshot, id: string) =>
  selectComponents(snapshot).find((component) => component.id === id);

export function makeAddComponent(
  ids: IdGen,
  kind: ComponentKind,
  pinCount?: number,
): AddComponentParams {
  return {
    id: ids.newId('cmp'),
    kind,
    pins: defaultPinIds(kind, pinCount).map((id) => ({ id, uid: ids.newId('pin') })),
  };
}
