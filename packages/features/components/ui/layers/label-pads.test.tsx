// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { newBoardDoc } from '@pcbk/domain';
import type { BoardPlacement, Vec2 } from '@pcbk/domain';
import { footprintPinIds } from '@pcbk/domain/footprints';
import { boardPads } from '@pcbk/domain/geometry';
import { Canvas, monoLabelHalf, sceneToScreenVector } from '@pcbk/ui';
import type { SceneTransform } from '@pcbk/ui';
import { setup } from '../../../__tests__/helpers';
import { componentLabelLayout } from './hits';
import { COMPONENTS_LAYERS } from './index';

afterEach(cleanup);

const transforms: SceneTransform[] = [
  'none',
  'rot90',
  'rot180',
  'rot270',
  'mirror',
  'mirror_rot90',
  'mirror_rot180',
  'mirror_rot270',
];
type Box = { left: number; right: number; top: number; bottom: number };
type Label = { text: string; at: Vec2; fontSize: number };
type Pad = ReturnType<typeof boardPads>[number];

function box(at: Vec2, half: Vec2): Box {
  return { left: at.x - half.x, right: at.x + half.x, top: at.y - half.y, bottom: at.y + half.y };
}

function textBox(label: Label, transform: SceneTransform, zoom: number): Box {
  return box(
    sceneToScreenVector(transform, label.at),
    monoLabelHalf(label.text, label.fontSize, zoom),
  );
}

function padBox({ at, halfPx, angleDeg, shape }: Pad, transform: SceneTransform): Box {
  const center = sceneToScreenVector(transform, at);
  if (shape === 'circle') return box(center, { x: halfPx.x, y: halfPx.x });
  const angle = (angleDeg * Math.PI) / 180;
  const axisX = sceneToScreenVector(transform, { x: Math.cos(angle), y: Math.sin(angle) });
  const axisY = sceneToScreenVector(transform, { x: -Math.sin(angle), y: Math.cos(angle) });
  return box(center, {
    x: Math.abs(axisX.x) * halfPx.x + Math.abs(axisY.x) * halfPx.y,
    y: Math.abs(axisX.y) * halfPx.x + Math.abs(axisY.y) * halfPx.y,
  });
}

function geometry(board: BoardPlacement, pxPerMm: number, zoom: number, transform: SceneTransform) {
  const layout = componentLabelLayout(board, pxPerMm, true, transform, zoom);
  // Model the drawn pad minimum independently of automatic label placement:
  // removing its clamp must still make the clearance assertions fail.
  const pads = boardPads(board, footprintPinIds(board.footprint, board.params)!, pxPerMm).map(
    (pad) => ({
      ...pad,
      halfPx: { x: Math.max(pad.halfPx.x, 2.5 / zoom), y: Math.max(pad.halfPx.y, 2.5 / zoom) },
    }),
  );
  const labels: Label[] =
    layout.textSize * zoom >= 8
      ? [
          { text: 'J29 ?', at: layout.at, fontSize: layout.textSize },
          { text: 'LONG CONNECTOR VALUE', at: layout.valueAt, fontSize: layout.textSize },
        ]
      : [];
  const numbers: Label[] = pads.flatMap(({ pinId, at, halfPx }) => {
    const shortHalf = Math.min(halfPx.x, halfPx.y);
    return shortHalf * zoom >= 7
      ? [{ text: pinId, at, fontSize: Math.max(shortHalf, 8 / zoom) }]
      : [];
  });
  return { labels, numbers, pads };
}

function overlap(a: Box, b: Box) {
  return (
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  );
}

function mount(board: BoardPlacement, zoom: number, transform: SceneTransform, pxPerMm = 10) {
  const doc = newBoardDoc('Sünteetiline sildikontroll');
  doc.scale.pxPerMm = pxPerMm;
  doc.components.push({
    id: 'cmp_j29',
    ref: 'J29',
    value: 'LONG CONNECTOR VALUE',
    kind: 'other',
    identified: false,
    dnp: false,
    marking: '',
    note: '',
    board,
    pins: footprintPinIds(board.footprint, board.params)!.map((id) => ({
      id,
      uid: `pin_${id}`,
      nc: false,
    })),
  });
  const { engine } = setup(doc);
  return render(
    <Canvas
      layers={COMPONENTS_LAYERS}
      tools={[]}
      snapshot={engine.snapshot()}
      execute={engine.execute}
      sceneTransform={transform}
      view={{ zoom, pan: { x: 0, y: 0 } }}
      onViewChange={() => {}}
    />,
  );
}

function checkAutomatic(footprint: 'header1' | 'qfp') {
  for (const [scale, pxPerMm, zoom] of [
    [0.2, 10, 0.5],
    [1, 0.2, 0.5],
    [1, 10, 1],
    [1, 10, 4],
  ] as const) {
    for (const rotationDeg of [270, 0, 35]) {
      for (const side of ['top', 'bottom'] as const) {
        for (const transform of transforms) {
          const board: BoardPlacement = {
            footprint,
            params: { pins: footprint === 'header1' ? 15 : 44 },
            center: { x: 500, y: 500 },
            rotationDeg,
            side,
            scaleX: scale,
            scaleY: scale,
            customPads: {},
          };
          const { labels, numbers, pads } = geometry(board, pxPerMm, zoom, transform);
          if (pxPerMm === 0.2) {
            // At this literal document scale the reference/value text is hidden.
            expect(labels).toHaveLength(0);
            continue;
          }
          expect(labels).toHaveLength(2);
          expect(pads).toHaveLength(footprint === 'header1' ? 15 : 44);
          if (
            pxPerMm === 10 &&
            ((footprint === 'header1' && scale === 1) || (footprint === 'qfp' && zoom === 4))
          ) {
            expect(numbers.length).toBeGreaterThan(0);
          }
          const context = `${footprint} ${side} ${transform} angle=${rotationDeg} scale=${scale} pxPerMm=${pxPerMm} zoom=${zoom}`;
          for (const label of labels) {
            const box = textBox(label, transform, zoom);
            for (const pad of pads)
              expect(overlap(box, padBox(pad, transform)) * zoom ** 2, context).toBe(0);
            for (const number of numbers)
              expect(overlap(box, textBox(number, transform, zoom)) * zoom ** 2, context).toBe(0);
          }
        }
      }
    }
  }
}

function checkRenderedCombination() {
  const board: BoardPlacement = {
    footprint: 'header1',
    params: { pins: 15 },
    center: { x: 500, y: 500 },
    rotationDeg: 35,
    side: 'bottom',
    scaleX: 1,
    scaleY: 1,
    customPads: {},
  };
  const zoom = 4;
  const transform = 'mirror_rot90';
  const { labels, numbers, pads } = geometry(board, 10, zoom, transform);
  // Only this representative combination creates a DOM. Pin numbers are visible
  // here, so the witness checks all text positions, sizes and centered anchors.
  const { container } = mount(board, zoom, transform);
  const texts = [
    ...container.querySelectorAll<SVGTextElement>('[data-layer="components.labels"] text'),
  ];
  expect(texts).toHaveLength(17);
  expect(numbers).toHaveLength(15);
  for (const label of [...labels, ...numbers]) {
    const text = texts.find((element) => element.textContent === label.text)!;
    expect(text).toBeDefined();
    expect(Number(text.getAttribute('x'))).toBeCloseTo(label.at.x);
    expect(Number(text.getAttribute('y'))).toBeCloseTo(label.at.y);
    expect(Number(text.getAttribute('font-size'))).toBeCloseTo(label.fontSize);
    expect(text.getAttribute('text-anchor')).toBe('middle');
    expect(text.getAttribute('dominant-baseline')).toBe('central');
  }
  const drawnPads = [
    ...container.querySelectorAll<SVGElement>(
      '[data-layer="components.pins"] [data-pin] > :first-child',
    ),
  ];
  expect(drawnPads).toHaveLength(15);
  for (const [index, pad] of pads.entries()) {
    const drawn = drawnPads[index]!;
    expect(drawn.parentElement?.getAttribute('data-pin')).toBe(pad.pinId);
    if (pad.shape === 'circle') {
      expect(drawn.tagName).toBe('circle');
      expect(Number(drawn.getAttribute('cx'))).toBeCloseTo(pad.at.x);
      expect(Number(drawn.getAttribute('cy'))).toBeCloseTo(pad.at.y);
      expect(Number(drawn.getAttribute('r'))).toBeCloseTo(pad.halfPx.x);
    } else {
      expect(drawn.tagName).toBe('rect');
      expect(Number(drawn.getAttribute('x'))).toBeCloseTo(pad.at.x - pad.halfPx.x);
      expect(Number(drawn.getAttribute('y'))).toBeCloseTo(pad.at.y - pad.halfPx.y);
      expect(Number(drawn.getAttribute('width'))).toBeCloseTo(2 * pad.halfPx.x);
      expect(Number(drawn.getAttribute('height'))).toBeCloseTo(2 * pad.halfPx.y);
      expect(drawn.getAttribute('transform')).toBe(
        `rotate(${pad.angleDeg} ${pad.at.x} ${pad.at.y})`,
      );
    }
  }
}

test('auto_label_clears_own_pads_and_pin_numbers_under_all_8_transforms', () => {
  checkAutomatic('header1');
  checkRenderedCombination();
});

test('auto_label_clears_qfp44_pads_under_all_8_transforms', () => {
  checkAutomatic('qfp');
});

test('manual_label_offset_is_never_moved', () => {
  for (const side of ['top', 'bottom'] as const)
    for (const transform of transforms) {
      const labelOffset = { x: 0, y: 0 };
      const board: BoardPlacement = {
        footprint: 'header1',
        params: { pins: 15 },
        center: { x: 500, y: 500 },
        rotationDeg: 270,
        side,
        scaleX: 0.2,
        scaleY: 0.2,
        customPads: {},
        labelOffset,
      };
      const layout = componentLabelLayout(board, 10, true, transform, 0.5);
      expect(layout.at).toEqual({ x: 500, y: 500 });
      expect(board.labelOffset).toEqual(labelOffset);
    }
});
