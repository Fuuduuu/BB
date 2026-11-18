import { expect, test } from 'vitest';
import { newBoardDoc } from '@pcbk/domain';
import type { BoardPlacement, Component, Vec2 } from '@pcbk/domain';
import { sceneToScreenVector, screenToSceneVector } from '@pcbk/ui';
import type { SceneTransform } from '@pcbk/ui';
import { componentLabelPlacements } from './label-placement';

function component(id: string, center: Vec2, board: Partial<BoardPlacement> = {}): Component {
  return {
    id,
    ref: id,
    kind: 'ic',
    marking: '',
    value: '',
    identified: true,
    dnp: false,
    note: '',
    pins: [],
    board: {
      footprint: 'area',
      params: { w: 2, h: 2 },
      center,
      side: 'top',
      rotationDeg: 0,
      scaleX: 1,
      scaleY: 1,
      customPads: {},
      ...board,
    },
  };
}

function point(id: string, center: Vec2, sizeMm: number, board: Partial<BoardPlacement> = {}) {
  const placed = component(id, center, {
    footprint: 'point',
    params: { type: 'tp', size: 0.2 },
    customPads: {
      own: { local: { x: 0, y: 0 }, sizeMm, shape: 'circle', through: false },
    },
    ...board,
  });
  placed.pins.push({ id: 'own', uid: `pin_${id}`, nc: false });
  return placed;
}

function document(...components: Component[]) {
  const doc = newBoardDoc('Siltide paigutus');
  doc.scale.pxPerMm = 10;
  doc.components = components;
  return doc;
}

function labelOffset(transform: SceneTransform, ...components: Component[]) {
  const label = componentLabelPlacements(document(...components), 1, transform).get('U1')!;
  return sceneToScreenVector(transform, label.offset);
}

test.each(['none', 'mirror_rot90'] as const)(
  'automatic labels prefer right and then left in screen axes (%s)',
  (transform) => {
    const at = (x: number, y: number) => screenToSceneVector(transform, { x, y });
    const target = component('U1', at(100, 100));
    const top = component('R1', at(100, 75));
    const bottom = component('R2', at(100, 125));
    const right = component('R3', at(125, 100));
    const left = component('R4', at(75, 100));

    expect(labelOffset(transform, target, top, bottom)).toEqual({
      x: expect.closeTo(24.52),
      y: expect.closeTo(0),
    });
    expect(labelOffset(transform, target, top, bottom, right)).toEqual({
      x: expect.closeTo(-24.52),
      y: expect.closeTo(0),
    });
    expect(labelOffset(transform, target, top, bottom, right, left)).toEqual({
      x: expect.closeTo(0),
      y: expect.closeTo(-23),
    });
    const manual = component('U1', at(100, 100), { labelOffset: { x: 7, y: -12 } });
    const placement = componentLabelPlacements(
      document(manual, top, bottom, right, left),
      1,
      transform,
    );
    expect(placement.get('U1')?.offset).toEqual({ x: 7, y: -12 });
  },
);

test('pad obstacles use the screen minimum and the rotated ellipse bounds', () => {
  const target = component('U1', { x: 100, y: 100 });
  const tinyPad = point('TP1', { x: 113, y: 90.5 }, 0.01);
  expect(labelOffset('none', target, tinyPad)).toEqual({ x: 0, y: 23 });

  const rotatedPad = point('TP2', { x: 139, y: 77 }, 2, { scaleX: 3, rotationDeg: 45 });
  expect(labelOffset('none', target, rotatedPad)).toEqual({
    x: expect.closeTo(0),
    y: expect.closeTo(-23),
  });
});

test('the grid also finds the near edge of a pad much larger than a grid cell', () => {
  const target = component('U1', { x: 100, y: 100 });
  const largePad = point('TP1', { x: -499_999_895, y: 77 }, 100_000_000);
  expect(labelOffset('none', target, largePad)).toEqual({
    x: expect.closeTo(24.52),
    y: expect.closeTo(0),
  });
});

test('label placements are shared by the document geometry consumers', () => {
  const doc = document(component('U1', { x: 100, y: 100 }));
  const result = componentLabelPlacements(doc, 1, 'none');
  expect(componentLabelPlacements(doc, 2, 'none')).not.toBe(result);
  expect(componentLabelPlacements(doc, 1, 'rot90')).not.toBe(result);
  expect(componentLabelPlacements(structuredClone(doc), 1, 'none')).not.toBe(result);
  expect(componentLabelPlacements(doc, 1, 'none')).toBe(result);
});
