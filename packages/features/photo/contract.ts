import { IdSchema, PhotoRefSchema, Vec2Schema } from '@pcbk/domain';
import { z } from 'zod';

export const AddPhotoSchema = z.strictObject({ photo: PhotoRefSchema });
export const SetPhotoTransformSchema = z.strictObject({
  id: IdSchema,
  transform: PhotoRefSchema.shape.transform,
});
export const SetPhotoScaleSchema = z.strictObject({
  a: Vec2Schema,
  b: Vec2Schema,
  mm: z.number().finite().positive().max(1000),
});

export type AddPhotoParams = z.infer<typeof AddPhotoSchema>;
export type SetPhotoTransformParams = z.infer<typeof SetPhotoTransformSchema>;
export type SetPhotoScaleParams = z.infer<typeof SetPhotoScaleSchema>;

declare module '@pcbk/contracts' {
  interface CommandMap {
    'photo.add': AddPhotoParams;
    'photo.setTransform': SetPhotoTransformParams;
    'photo.setScale': SetPhotoScaleParams;
  }
}
