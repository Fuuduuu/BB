import { expect, test } from 'vitest';
import { newBoardDoc } from '@pcbk/domain';
import { boardSurface, sceneTransformOf } from '@pcbk/domain/geometry';
import { PhotoRefSchema } from '@pcbk/domain';

test('board_surface_uses_active_photo_or_default', () => {
  expect(boardSurface).toBeTypeOf('function');
  expect(boardSurface(newBoardDoc('Fotota'))).toEqual({ width: 2000, height: 1400 });

  const photos = Object.freeze([
    Object.freeze({ id: 'pho_first', widthPx: 100, heightPx: 200 }),
    Object.freeze({
      id: 'pho_active',
      widthPx: 4032,
      heightPx: 3024,
      transform: 'rot90',
      toBoard: [1, 0, 0, 1, 0, 0] as const,
    }),
  ]);
  const doc = Object.freeze({ photos, activePhotoId: 'pho_active' });
  expect(boardSurface(doc)).toEqual({ width: 4032, height: 3024 });
  expect(boardSurface({ photos })).toEqual({ width: 2000, height: 1400 });
  expect(boardSurface({ photos, activePhotoId: 'pho_missing' })).toEqual({
    width: 2000,
    height: 1400,
  });
  expect(boardSurface({ photos: [], activePhotoId: 'pho_missing' })).toEqual({
    width: 2000,
    height: 1400,
  });
  expect(photos[1]).toMatchObject({ widthPx: 4032, heightPx: 3024, transform: 'rot90' });
});

test('scene_transform_of_uses_active_photo_or_none', () => {
  expect(sceneTransformOf).toBeTypeOf('function');
  expect(sceneTransformOf(newBoardDoc('Fotota'))).toBe('none');
  for (const transform of PhotoRefSchema.shape.transform.options) {
    const photos = Object.freeze([
      Object.freeze({ id: 'first', widthPx: 10, heightPx: 20, transform: 'none' as const }),
      Object.freeze({ id: 'active', widthPx: 40, heightPx: 30, transform }),
    ]);
    expect(sceneTransformOf(Object.freeze({ photos, activePhotoId: 'active' }))).toBe(transform);
    expect(sceneTransformOf({ photos })).toBe('none');
    expect(sceneTransformOf({ photos, activePhotoId: 'unknown' })).toBe('none');
  }
});
