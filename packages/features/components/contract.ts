import {
  BoardPlacementSchema,
  ComponentKindSchema,
  defaultPinIds,
  footprintGeometry,
  IdSchema,
  PinSchema,
  SideSchema,
  SymbolPlacementSchema,
  Vec2Schema,
} from '@pcbk/domain';
import type { ComponentKind, FootprintParams, Vec2 } from '@pcbk/domain';
import { stringRecord } from '@pcbk/domain/model';
import type { IdGen, Snapshot } from '@pcbk/contracts';
import { z } from 'zod';
import type { LibraryEntry } from './contract/library';

export * from './contract/library';
export {
  COMPONENT_SCALE_MAX,
  COMPONENT_SCALE_MIN,
  previewBoardScale,
  readScaleDrag,
  SCALE_DRAG_OWNER,
} from './contract/scale-preview';

const footprintParams = z.unknown().transform((input, context) => {
  const parsed = BoardPlacementSchema.shape.params.safeParse(input);
  if (parsed.success) return parsed.data;
  context.addIssue({ code: 'custom', message: 'invalid_footprint' });
  return z.NEVER;
});

export const BoardInputSchema = z.strictObject({
  footprint: z.string({ error: 'invalid_footprint' }),
  params: footprintParams.optional(),
  center: Vec2Schema,
  rotationDeg: z.number().optional(),
  side: SideSchema.optional(),
});

const pinIdentity = PinSchema.pick({ id: true, uid: true });
const namedPinIdentity = PinSchema.pick({ id: true, uid: true, name: true });
export const AddComponentSchema = z.strictObject({
  id: IdSchema,
  kind: ComponentKindSchema,
  ref: z.string().trim().min(1).optional(),
  pins: z.array(namedPinIdentity),
  marking: z.string().optional(),
  value: z.string().optional(),
  board: BoardInputSchema.optional(),
  schematic: SymbolPlacementSchema.pick({ at: true, rot: true, mirror: true }).optional(),
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
export const ComponentTargetSchema = z.strictObject({ id: IdSchema });
export const ComponentListSchema = z.strictObject({ ids: z.array(IdSchema).min(1) });
export const AddOwnPinSchema = ComponentTargetSchema.extend({
  pin: namedPinIdentity,
  local: Vec2Schema,
  sizeMm: BoardPlacementSchema.shape.customPads.out.valueType.shape.sizeMm,
});
export const PlaceOnBoardSchema = ComponentTargetSchema.extend({ board: BoardInputSchema });
export const ChangeFootprintSchema = ComponentTargetSchema.extend({
  footprint: z.string({ error: 'invalid_footprint' }),
  params: footprintParams,
  newPinUids: BoardPlacementSchema.shape.padMap.unwrap(),
});
export const RotateSchema = ComponentListSchema.extend({ deltaDeg: z.number() });
export const DuplicateSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        sourceId: IdSchema,
        id: IdSchema,
        pinUids: stringRecord(IdSchema, IdSchema),
      }),
    )
    .min(1),
});
export const SetScaleSchema = ComponentTargetSchema.extend({
  scaleX: BoardPlacementSchema.shape.scaleX,
  scaleY: BoardPlacementSchema.shape.scaleY,
});
export const AlignSchema = SetScaleSchema.extend({
  center: Vec2Schema,
  rotationDeg: z.number(),
});
const PhysicalPinSchema = z.strictObject({
  id: IdSchema,
  padIndex: z.number().int().nonnegative(),
});
export const ScaleFromPinsSchema = ComponentTargetSchema.extend({
  pinA: PhysicalPinSchema,
  pinB: PhysicalPinSchema,
  targetA: Vec2Schema,
  targetB: Vec2Schema,
  mm: z.number().positive(),
});
export const SetLabelOffsetSchema = ComponentTargetSchema.extend({ offset: Vec2Schema.nullable() });

export type BoardInput = z.infer<typeof BoardInputSchema>;
export type AddComponentParams = z.infer<typeof AddComponentSchema>;
export type UpdateComponentParams = z.infer<typeof UpdateComponentSchema>;
export type AddPinParams = z.infer<typeof AddPinSchema>;
export type AddOwnPinParams = z.infer<typeof AddOwnPinSchema>;
export type PinTargetParams = z.infer<typeof PinTargetSchema>;
export type RenamePinParams = z.infer<typeof RenamePinSchema>;
export type SetNcParams = z.infer<typeof SetNcSchema>;
export type ComponentTargetParams = z.infer<typeof ComponentTargetSchema>;
export type ComponentListParams = z.infer<typeof ComponentListSchema>;
export type PlaceOnBoardParams = z.infer<typeof PlaceOnBoardSchema>;
export type ChangeFootprintParams = z.infer<typeof ChangeFootprintSchema>;
export type RotateParams = z.infer<typeof RotateSchema>;
export type DuplicateParams = z.infer<typeof DuplicateSchema>;
export type SetScaleParams = z.infer<typeof SetScaleSchema>;
export type AlignParams = z.infer<typeof AlignSchema>;
export type ScaleFromPinsParams = z.infer<typeof ScaleFromPinsSchema>;
export type SetLabelOffsetParams = z.infer<typeof SetLabelOffsetSchema>;

declare module '@pcbk/contracts' {
  interface Derived {
    unplacedBoard: string[];
    unplacedSchematic: string[];
  }

  interface CommandMap {
    'components.add': AddComponentParams;
    'components.update': UpdateComponentParams;
    'components.addPin': AddPinParams;
    'components.addOwnPin': AddOwnPinParams;
    'components.renamePin': RenamePinParams;
    'components.setNc': SetNcParams;
    'components.removePin': PinTargetParams;
    'components.placeOnBoard': PlaceOnBoardParams;
    'components.changeFootprint': ChangeFootprintParams;
    'components.removeFromBoard': ComponentListParams;
    'components.rotate': RotateParams;
    'components.flipSide': ComponentListParams;
    'components.duplicate': DuplicateParams;
    'components.setScale': SetScaleParams;
    'components.align': AlignParams;
    'components.scaleFromPins': ScaleFromPinsParams;
    'components.setLabelOffset': SetLabelOffsetParams;
  }
}

export const selectComponents = (snapshot: Pick<Snapshot, 'doc'>): Snapshot['doc']['components'] =>
  snapshot.doc.components;
export const selectComponent = (snapshot: Pick<Snapshot, 'doc'>, id: string) =>
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

export function makePlacedComponent(
  ids: IdGen,
  entry: LibraryEntry,
  params: FootprintParams,
  center: Vec2,
): AddComponentParams {
  const board = { footprint: entry.footprint, params: { ...entry.params, ...params }, center };
  const pads = footprintGeometry(board.footprint, board.params)?.pads ?? [];
  return {
    id: ids.newId('cmp'),
    kind: entry.kind,
    pins: pads.map(({ id, name }) => ({
      id,
      uid: ids.newId('pin'),
      ...(name === undefined ? {} : { name }),
    })),
    board,
  };
}
