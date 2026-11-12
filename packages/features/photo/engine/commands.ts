import { reject } from '@pcbk/engine';
import type { CommandSpec } from '@pcbk/engine';
import { AddPhotoSchema, SetPhotoScaleSchema, SetPhotoTransformSchema } from '../contract';
import type { AddPhotoParams, SetPhotoScaleParams, SetPhotoTransformParams } from '../contract';

const add: CommandSpec<AddPhotoParams> = {
  id: 'photo.add',
  title: 'photo.add',
  params: AddPhotoSchema,
  run(doc, { photo }) {
    if (doc.photos.length > 0) reject('photo_limit');
    if (photo.side !== 'top') reject('photo_side_unsupported');
    if (photo.toBoard !== undefined) reject('photo_alignment_unsupported');
    doc.photos.push(photo);
    doc.activePhotoId = photo.id;
  },
};

const setTransform: CommandSpec<SetPhotoTransformParams> = {
  id: 'photo.setTransform',
  title: 'photo.setTransform',
  params: SetPhotoTransformSchema,
  run(doc, { id, transform }) {
    const photo = doc.photos.find((entry) => entry.id === id);
    if (!photo) reject('photo_missing');
    if (photo.transform !== transform) photo.transform = transform;
  },
};

const setScale: CommandSpec<SetPhotoScaleParams> = {
  id: 'photo.setScale',
  title: 'photo.setScale',
  params: SetPhotoScaleSchema,
  run(doc, { a, b, mm }) {
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    if (distance < 5) reject('calibration_too_short');
    const pxPerMm = distance / mm;
    if (!Number.isFinite(pxPerMm) || pxPerMm < 0.1 || pxPerMm > 1000) {
      reject('calibration_out_of_range');
    }
    doc.scale = { pxPerMm, calibrated: true, calib: { a, b, mm } };
  },
};

export const commands = [add, setTransform, setScale];
