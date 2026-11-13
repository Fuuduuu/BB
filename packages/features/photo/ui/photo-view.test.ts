import { expect, test } from 'vitest';
import { readPhotoView } from './photo-view';

test('read_photo_view_repairs_each_field', () => {
  const defaults = { visible: true, opacity: 1, contrast: 1, gray: false };
  for (const value of [undefined, null, true, 12, 'photo', []]) {
    expect(readPhotoView(value)).toEqual(defaults);
  }
  expect(readPhotoView({ visible: false, opacity: 0.4, contrast: 1.5, gray: true })).toEqual({
    visible: false,
    opacity: 0.4,
    contrast: 1.5,
    gray: true,
  });
  expect(readPhotoView({ visible: 0, opacity: -9, contrast: 9, gray: 'yes' })).toEqual({
    ...defaults,
    opacity: 0.1,
    contrast: 2,
  });
  expect(readPhotoView({ visible: false, opacity: 9, contrast: -9, gray: true })).toEqual({
    visible: false,
    opacity: 1,
    contrast: 0.5,
    gray: true,
  });
  for (const invalid of ['0.5', null, true, NaN, Infinity, -Infinity]) {
    expect(
      readPhotoView({ visible: false, opacity: invalid, contrast: invalid, gray: true }),
    ).toEqual({
      ...defaults,
      visible: false,
      gray: true,
    });
  }
});
