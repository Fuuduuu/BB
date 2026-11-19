import { EndRefSchema, IdSchema } from '@pcbk/domain';
import { z } from 'zod';

const EndInput = z.strictObject({ id: IdSchema, a: EndRefSchema, b: EndRefSchema });

export const AddConnectionsSchema = z.strictObject({
  items: z.array(EndInput).min(1),
  basis: z.enum(['assumed', 'visual']),
  skipJoined: z.boolean(),
});
export const ConnectionIdsSchema = z.strictObject({ ids: z.array(z.string()).min(1) });

export type AddConnectionsParams = z.infer<typeof AddConnectionsSchema>;
export type ConnectionIdsParams = z.infer<typeof ConnectionIdsSchema>;

declare module '@pcbk/contracts' {
  interface CommandMap {
    'connections.add': AddConnectionsParams;
    'connections.remove': ConnectionIdsParams;
    'connections.removeBoardDrawing': ConnectionIdsParams;
    'junctions.remove': ConnectionIdsParams;
  }
}
