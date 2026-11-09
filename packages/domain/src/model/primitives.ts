import { z } from 'zod';

export const IdSchema = z.string().min(1);
export const CountSchema = z.number().int().nonnegative();
export const TimestampSchema = z.iso.datetime();
export const Vec2Schema = z.strictObject({ x: z.number(), y: z.number() });
export const PinRefSchema = z.strictObject({ c: IdSchema, p: IdSchema });
export const EndRefSchema = z.union([
  z.strictObject({ pin: PinRefSchema }),
  z.strictObject({ junction: IdSchema }),
]);
export const MeasuredPinSchema = PinRefSchema.extend({ uid: IdSchema });
export const SideSchema = z.enum(['top', 'bottom']);
export const LayerSchema = SideSchema;

export type Vec2 = z.infer<typeof Vec2Schema>;
export type PinRef = z.infer<typeof PinRefSchema>;
export type EndRef = z.infer<typeof EndRefSchema>;
export type MeasuredPin = z.infer<typeof MeasuredPinSchema>;
export type Side = z.infer<typeof SideSchema>;
export type Layer = z.infer<typeof LayerSchema>;
