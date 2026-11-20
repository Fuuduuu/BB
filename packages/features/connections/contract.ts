import { EndRefSchema, IdSchema, LayerSchema, PinRefSchema, Vec2Schema } from '@pcbk/domain';
import { z } from 'zod';

export const TRACE_WIDTH_MM = 0.3;
export const WIRE_WIDTH_MM = 0.5;

const BoardDrawingInput = z.strictObject({
  kind: z.enum(['trace', 'wire']),
  layer: LayerSchema,
  waypoints: z.array(Vec2Schema),
  widthMm: z.number().positive(),
});
const EndInput = z.strictObject({
  id: IdSchema,
  a: EndRefSchema,
  b: EndRefSchema,
  board: BoardDrawingInput.optional(),
});
const JunctionInput = z.strictObject({
  id: IdSchema,
  board: z.strictObject({ at: Vec2Schema, layer: LayerSchema }),
});

export const AddConnectionsSchema = z.strictObject({
  items: z.array(EndInput).min(1),
  basis: z.enum(['assumed', 'visual']),
  skipJoined: z.boolean(),
  junctions: z.array(JunctionInput).optional(),
});
export const ConnectionIdsSchema = z.strictObject({ ids: z.array(z.string()).min(1) });
export const DrawOnBoardSchema = z.strictObject({ id: z.string(), board: BoardDrawingInput });
export const BranchConnectionSchema = z.strictObject({
  target: z.string(),
  segment: z.number(),
  at: Vec2Schema,
  junctionId: z.string(),
  splitId: z.string(),
  trace: EndInput,
});
export const UpdateConnectionSchema = z.strictObject({
  id: z.string(),
  waypoints: z.array(Vec2Schema),
});
export const InsertWaypointSchema = z.strictObject({
  id: z.string(),
  index: z.number(),
  at: Vec2Schema,
});
export const RemoveWaypointSchema = z.strictObject({ id: z.string(), index: z.number() });
export const MoveJunctionSchema = z.strictObject({ id: z.string(), at: Vec2Schema });
export const AttachJunctionToPinSchema = z.strictObject({ id: z.string(), pin: PinRefSchema });

export type AddConnectionsParams = z.infer<typeof AddConnectionsSchema>;
export type ConnectionIdsParams = z.infer<typeof ConnectionIdsSchema>;
export type DrawOnBoardParams = z.infer<typeof DrawOnBoardSchema>;
export type BranchConnectionParams = z.infer<typeof BranchConnectionSchema>;
export type UpdateConnectionParams = z.infer<typeof UpdateConnectionSchema>;
export type InsertWaypointParams = z.infer<typeof InsertWaypointSchema>;
export type RemoveWaypointParams = z.infer<typeof RemoveWaypointSchema>;
export type MoveJunctionParams = z.infer<typeof MoveJunctionSchema>;
export type AttachJunctionToPinParams = z.infer<typeof AttachJunctionToPinSchema>;

declare module '@pcbk/contracts' {
  interface CommandMap {
    'connections.add': AddConnectionsParams;
    'connections.drawOnBoard': DrawOnBoardParams;
    'connections.branch': BranchConnectionParams;
    'connections.update': UpdateConnectionParams;
    'connections.insertWaypoint': InsertWaypointParams;
    'connections.removeWaypoint': RemoveWaypointParams;
    'connections.remove': ConnectionIdsParams;
    'connections.removeBoardDrawing': ConnectionIdsParams;
    'junctions.move': MoveJunctionParams;
    'junctions.attachToPin': AttachJunctionToPinParams;
    'junctions.remove': ConnectionIdsParams;
  }
}
