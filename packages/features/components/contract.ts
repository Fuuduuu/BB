import {
  BoardPlacementSchema,
  ComponentKindSchema,
  defaultPinIds,
  footprintPinIds,
  IdSchema,
  PinSchema,
  SideSchema,
  Vec2Schema,
} from '@pcbk/domain';
import type { ComponentKind, FootprintParams, Vec2 } from '@pcbk/domain';
import type { IdGen, Snapshot } from '@pcbk/contracts';
import { z } from 'zod';

export interface LibraryEntry {
  id: string;
  kind: ComponentKind;
  footprint: string;
  params: FootprintParams;
  kw: string;
}

export const COMPONENT_LIBRARY: readonly LibraryEntry[] = [
  {
    id: 'r_smd',
    kind: 'resistor',
    footprint: 'chip',
    params: { size: '0805' },
    kw: 'resistor chip',
  },
  {
    id: 'c_smd',
    kind: 'capacitor',
    footprint: 'chip',
    params: { size: '0805' },
    kw: 'capacitor mlcc',
  },
  { id: 'sot23', kind: 'npn', footprint: 'sot23', params: { pins: 3 }, kw: 'transistor mosfet' },
  { id: 'soic', kind: 'ic', footprint: 'soic', params: { pins: 8, body: 3.9 }, kw: 'so ic' },
  { id: 'to220', kind: 'regulator', footprint: 'to220', params: {}, kw: 'regulator mosfet' },
  {
    id: 'hdr1',
    kind: 'connector',
    footprint: 'header1',
    params: { pins: 4, pitch: 2.54 },
    kw: 'header pin',
  },
  {
    id: 'unknown',
    kind: 'other',
    footprint: 'area',
    params: { w: 8, h: 10 },
    kw: 'unknown generic custom',
  },
];

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
export const AddComponentSchema = z.strictObject({
  id: IdSchema,
  kind: ComponentKindSchema,
  ref: z.string().trim().min(1).optional(),
  pins: z.array(pinIdentity),
  marking: z.string().optional(),
  value: z.string().optional(),
  board: BoardInputSchema.optional(),
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
export const PlaceOnBoardSchema = ComponentTargetSchema.extend({ board: BoardInputSchema });
export const RotateSchema = ComponentTargetSchema.extend({ deltaDeg: z.number() });
export const SetLabelOffsetSchema = ComponentTargetSchema.extend({ offset: Vec2Schema.nullable() });

export type BoardInput = z.infer<typeof BoardInputSchema>;
export type AddComponentParams = z.infer<typeof AddComponentSchema>;
export type UpdateComponentParams = z.infer<typeof UpdateComponentSchema>;
export type AddPinParams = z.infer<typeof AddPinSchema>;
export type PinTargetParams = z.infer<typeof PinTargetSchema>;
export type RenamePinParams = z.infer<typeof RenamePinSchema>;
export type SetNcParams = z.infer<typeof SetNcSchema>;
export type ComponentTargetParams = z.infer<typeof ComponentTargetSchema>;
export type PlaceOnBoardParams = z.infer<typeof PlaceOnBoardSchema>;
export type RotateParams = z.infer<typeof RotateSchema>;
export type SetLabelOffsetParams = z.infer<typeof SetLabelOffsetSchema>;

declare module '@pcbk/contracts' {
  interface CommandMap {
    'components.add': AddComponentParams;
    'components.update': UpdateComponentParams;
    'components.addPin': AddPinParams;
    'components.renamePin': RenamePinParams;
    'components.setNc': SetNcParams;
    'components.removePin': PinTargetParams;
    'components.placeOnBoard': PlaceOnBoardParams;
    'components.removeFromBoard': ComponentTargetParams;
    'components.rotate': RotateParams;
    'components.flipSide': ComponentTargetParams;
    'components.setLabelOffset': SetLabelOffsetParams;
  }
}

export const selectComponents = (snapshot: Pick<Snapshot, 'doc'>) => snapshot.doc.components;
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
  const pinIds = footprintPinIds(board.footprint, board.params) ?? [];
  return {
    id: ids.newId('cmp'),
    kind: entry.kind,
    pins: pinIds.map((id) => ({ id, uid: ids.newId('pin') })),
    board,
  };
}
