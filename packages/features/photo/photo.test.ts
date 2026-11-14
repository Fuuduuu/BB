import { newBoardDoc } from '@pcbk/domain';
import type { BoardDoc, PhotoRef } from '@pcbk/domain';
import { buildRegistry, createEngine } from '@pcbk/engine';
import { expect, test } from 'vitest';
import { engineFeatures, RESERVED_FIELDS } from '../engine';

const photo: PhotoRef = {
  id: 'pho_a',
  side: 'top',
  name: 'Plaat',
  widthPx: 3000,
  heightPx: 2000,
  transform: 'none',
};
const calibration = { a: { x: 10, y: 20 }, b: { x: 310, y: 420 }, mm: 25 };

function setup(doc: BoardDoc = newBoardDoc('Plaat')) {
  const result = createEngine({
    modules: engineFeatures,
    reserved: RESERVED_FIELDS,
    clock: { now: () => '2026-11-12T10:00:00.000Z' },
  });
  result.host.load('photo-test', doc, false);
  return result;
}

function withPhoto() {
  const doc = newBoardDoc('Plaat');
  doc.photos = [{ ...photo }];
  doc.activePhotoId = photo.id;
  return setup(doc);
}

test('photo_module_owns_photo_fields', () => {
  const module = engineFeatures.find((entry) => entry.id === 'photo');
  expect(module?.owns).toEqual(['photos', 'activePhotoId', 'scale']);
  expect(module?.dependsOn).toBeUndefined();
  expect(module?.derive).toBeUndefined();
  const registry = buildRegistry(engineFeatures, RESERVED_FIELDS);
  for (const field of ['photos', 'activePhotoId', 'scale'] as const) {
    expect(registry.reserved.has(field)).toBe(false);
  }
  for (const id of ['photo.add', 'photo.setTransform', 'photo.setScale']) {
    expect(registry.commands.get(id)?.fields).toEqual(
      new Set(['photos', 'activePhotoId', 'scale']),
    );
    expect(registry.commands.get(id)?.spec.title).toBe(id);
  }
});

test('photo_add_sets_active_photo_in_one_undoable_step', () => {
  const { engine, host } = setup();
  expect(engine.execute('photo.add', { photo })).toEqual({ ok: true, value: { rev: 1 } });
  expect(engine.snapshot().doc.photos).toEqual([photo]);
  expect(engine.snapshot().doc.activePhotoId).toBe('pho_a');
  expect(host.drainJournal()).toHaveLength(1);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.photos).toEqual([]);
  expect(engine.snapshot().doc.activePhotoId).toBeUndefined();
  expect(engine.snapshot().history).toEqual({ canUndo: false, canRedo: true });
  expect(engine.redo().ok).toBe(true);
  expect(engine.snapshot().doc).toMatchObject({ photos: [photo], activePhotoId: 'pho_a' });
});

test('photo_add_rejects_second_photo', () => {
  const { engine, host } = withPhoto();
  const before = engine.snapshot();
  expect(engine.execute('photo.add', { photo: { ...photo, id: 'pho_b' } })).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [{ message: 'photo_limit' }] },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});

test('photo_add_rejects_bottom_side_and_alignment', () => {
  const { engine, host } = setup();
  const before = engine.snapshot();
  for (const [input, reason] of [
    [{ ...photo, side: 'bottom' }, 'photo_side_unsupported'],
    [{ ...photo, toBoard: [1, 0, 0, 1, 0, 0] }, 'photo_alignment_unsupported'],
  ] as const) {
    expect(engine.execute('photo.add', { photo: input } as never)).toMatchObject({
      ok: false,
      error: { code: 'validation', issues: [{ message: reason }] },
    });
    expect(engine.snapshot()).toBe(before);
  }
  expect(host.drainJournal()).toEqual([]);
});

test.each([
  { id: '' },
  { widthPx: 0 },
  { heightPx: -1 },
  { widthPx: 3.5 },
  { heightPx: Infinity },
  { transform: 'rot45' },
  { side: 'left' },
  { extra: true },
])('photo_add_validates_photo_reference %#', (invalid) => {
  const { engine, host } = setup();
  const before = engine.snapshot();
  expect(engine.execute('photo.add', { photo: { ...photo, ...invalid } } as never)).toMatchObject({
    ok: false,
    error: { code: 'validation' },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});

test('set_transform_changes_only_transform_and_undoes', () => {
  const { engine, host } = withPhoto();
  const before = engine.snapshot().doc;
  expect(engine.execute('photo.setTransform', { id: photo.id, transform: 'mirror_rot90' })).toEqual(
    {
      ok: true,
      value: { rev: 1 },
    },
  );
  expect(engine.snapshot().doc).toEqual({
    ...before,
    rev: 1,
    photos: [{ ...photo, transform: 'mirror_rot90' }],
  });
  expect(host.drainJournal()).toHaveLength(1);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc).toEqual({ ...before, rev: 2 });
  expect(engine.snapshot().history.canUndo).toBe(false);
});

test('set_transform_same_value_keeps_rev', () => {
  const { engine, host } = withPhoto();
  engine.execute('photo.setTransform', { id: photo.id, transform: 'rot90' });
  engine.execute('photo.setTransform', { id: photo.id, transform: 'rot180' });
  engine.undo();
  const before = engine.snapshot();
  const journal = host.drainJournal();
  host.requeueJournal(journal);
  let notices = 0;
  engine.subscribe(() => {
    notices++;
  });
  expect(engine.execute('photo.setTransform', { id: photo.id, transform: 'rot90' })).toEqual({
    ok: true,
    value: { rev: before.rev },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual(journal);
  expect(notices).toBe(0);
  expect(engine.redo().ok).toBe(true);
  expect(engine.snapshot().doc.photos[0]?.transform).toBe('rot180');
  engine.undo();
  engine.undo();
  expect(engine.snapshot().doc.photos[0]?.transform).toBe('none');
  expect(engine.snapshot().history.canUndo).toBe(false);
});

test('set_transform_unknown_photo_is_rejected', () => {
  const { engine, host } = withPhoto();
  const before = engine.snapshot();
  expect(
    engine.execute('photo.setTransform', { id: 'pho_missing', transform: 'rot90' }),
  ).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [{ message: 'photo_missing' }] },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});

test.each([
  'none',
  'rot90',
  'rot180',
  'rot270',
  'mirror',
  'mirror_rot90',
  'mirror_rot180',
  'mirror_rot270',
] as const)('set_transform_accepts_supported_transform %s', (transform) => {
  const { engine } = withPhoto();
  expect(engine.execute('photo.setTransform', { id: photo.id, transform }).ok).toBe(true);
  expect(engine.snapshot().doc.photos[0]?.transform).toBe(transform);
});

test.each([{ transform: 'rot45' }, { id: '' }, { extra: true }])(
  'set_transform_validates_params %#',
  (invalid) => {
    const { engine } = withPhoto();
    const before = engine.snapshot();
    expect(
      engine.execute('photo.setTransform', {
        id: photo.id,
        transform: 'rot90',
        ...invalid,
      } as never),
    ).toMatchObject({
      ok: false,
      error: { code: 'validation' },
    });
    expect(engine.snapshot()).toBe(before);
  },
);

test('set_scale_computes_px_per_mm_from_points', () => {
  const { engine, host } = setup();
  const before = engine.snapshot().doc;
  expect(engine.execute('photo.setScale', calibration)).toEqual({ ok: true, value: { rev: 1 } });
  expect(engine.snapshot().doc).toEqual({
    ...before,
    rev: 1,
    scale: { pxPerMm: 20, calibrated: true, calib: calibration },
  });
  expect(host.drainJournal()).toHaveLength(1);
  expect(engine.undo().ok).toBe(true);
  expect(engine.snapshot().doc.scale).toEqual(before.scale);
  expect(engine.snapshot().history.canUndo).toBe(false);
  expect(engine.redo().ok).toBe(true);
  expect(engine.snapshot().doc.scale).toEqual({
    pxPerMm: 20,
    calibrated: true,
    calib: calibration,
  });
});

test('set_scale_keeps_component_centers', () => {
  const { engine, host } = setup();
  expect(
    engine.execute('components.add', {
      id: 'cmp_a',
      kind: 'resistor',
      pins: [
        { id: '1', uid: 'pin_a' },
        { id: '2', uid: 'pin_b' },
      ],
      board: { footprint: 'chip', params: { size: '0805' }, center: { x: 123, y: 456 } },
    }).ok,
  ).toBe(true);
  const before = engine.snapshot().doc.components;
  host.drainJournal();
  expect(engine.execute('photo.setScale', calibration).ok).toBe(true);
  expect(engine.snapshot().doc.components).toEqual(before);
  expect(engine.snapshot().doc.components[0]?.board?.center).toEqual({ x: 123, y: 456 });
  expect(host.drainJournal()).toHaveLength(1);
  engine.undo();
  expect(engine.snapshot().doc.components).toEqual(before);
});

test('set_scale_rejects_short_or_out_of_range', () => {
  const { engine, host } = setup();
  const before = engine.snapshot();
  for (const [b, mm, reason] of [
    [{ x: 0, y: 0 }, 10, 'calibration_too_short'],
    [{ x: 4.999, y: 0 }, 10, 'calibration_too_short'],
    [{ x: 5, y: 0 }, 1000, 'calibration_out_of_range'],
    [{ x: 1000.001, y: 0 }, 1, 'calibration_out_of_range'],
    [{ x: 5, y: 0 }, Number.MIN_VALUE, 'calibration_out_of_range'],
    [{ x: Number.MAX_VALUE, y: Number.MAX_VALUE }, 1, 'calibration_out_of_range'],
  ] as const) {
    expect(engine.execute('photo.setScale', { a: { x: 0, y: 0 }, b, mm })).toMatchObject({
      ok: false,
      error: { code: 'validation', issues: [{ message: reason }] },
    });
    expect(engine.snapshot()).toBe(before);
  }
  expect(
    engine.execute('photo.setScale', {
      a: { x: -Number.MAX_VALUE, y: 0 },
      b: { x: Number.MAX_VALUE, y: 0 },
      mm: 1000,
    }),
  ).toMatchObject({
    ok: false,
    error: { code: 'validation', issues: [{ message: 'calibration_out_of_range' }] },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});

test.each([
  [5, 50, 0.1],
  [5, 0.005, 1000],
  [100, 1000, 0.1],
])('set_scale_accepts_boundaries distance %s mm %s', (distance, mm, pxPerMm) => {
  const { engine } = setup();
  expect(
    engine.execute('photo.setScale', { a: { x: 0, y: 0 }, b: { x: 0, y: distance }, mm }).ok,
  ).toBe(true);
  expect(engine.snapshot().doc.scale.pxPerMm).toBe(pxPerMm);
});

test.each([
  { mm: 0 },
  { mm: -1 },
  { mm: 1000.001 },
  { mm: Infinity },
  { mm: -Infinity },
  { mm: NaN },
  { a: { x: Infinity, y: 0 } },
  { a: { x: 0, y: NaN } },
  { b: { x: -Infinity, y: 0 } },
  { b: { x: 0, y: Infinity } },
  { a: { x: 0 } },
  { b: { x: 0, y: 100, z: 1 } },
  { pxPerMm: 20 },
])('set_scale_rejects_invalid_params %#', (invalid) => {
  const { engine, host } = setup();
  const before = engine.snapshot();
  expect(engine.execute('photo.setScale', { ...calibration, ...invalid } as never)).toMatchObject({
    ok: false,
    error: { code: 'validation' },
  });
  expect(engine.snapshot()).toBe(before);
  expect(host.drainJournal()).toEqual([]);
});
