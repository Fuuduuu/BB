import type { DocumentEngine } from '@pcbk/contracts';
import type { PhotoRef } from '@pcbk/domain';
import type { AddPhotoParams, SetPhotoScaleParams, SetPhotoTransformParams } from './contract';

declare const engine: DocumentEngine;
declare const photo: PhotoRef;
declare const add: AddPhotoParams;
declare const transform: SetPhotoTransformParams;
declare const scale: SetPhotoScaleParams;
engine.execute('photo.add', { photo });
engine.execute('photo.add', add);
engine.execute('photo.setTransform', transform);
engine.execute('photo.setScale', scale);
engine.execute('photo.setTransform', { id: photo.id, transform: 'mirror_rot270' });
engine.execute('photo.setScale', { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, mm: 10 });
// @ts-expect-error adding a photo requires a complete PhotoRef
engine.execute('photo.add', { photo: { id: 'photo_a' } });
// @ts-expect-error transforms are limited to the domain's eight supported values
engine.execute('photo.setTransform', { id: photo.id, transform: 'rot45' });
// @ts-expect-error a transform needs the target photo identity
engine.execute('photo.setTransform', { transform: 'none' });
// @ts-expect-error scale is computed from points and distance, not caller-supplied pxPerMm
engine.execute('photo.setScale', { pxPerMm: 10, calib: scale });
// @ts-expect-error calibration points require both coordinates
engine.execute('photo.setScale', { ...scale, a: { x: 0 } });
// @ts-expect-error calibration distance is a number
engine.execute('photo.setScale', { ...scale, mm: '10' });
