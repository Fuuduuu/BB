import { expect, test } from 'vitest';
import { newBoardDoc } from '@pcbk/domain';
import { boardSurface } from '@pcbk/domain/geometry';

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
