// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { newBoardDoc } from '@pcbk/domain';
import type { BoardPlacement } from '@pcbk/domain';
import { footprintPinIds } from '@pcbk/domain/footprints';
import { Canvas, monoLabelHalf, sceneToScreenVector } from '@pcbk/ui';
import type { SceneTransform } from '@pcbk/ui';
import { setup } from '../../../__tests__/helpers';
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

function textBox(text: SVGTextElement, transform: SceneTransform, zoom: number): Box {
  expect(text.getAttribute('text-anchor')).toBe('middle');
  expect(text.getAttribute('dominant-baseline')).toBe('central');
  const at = sceneToScreenVector(transform, {
    x: Number(text.getAttribute('x')),
    y: Number(text.getAttribute('y')),
  });
  const half = monoLabelHalf(text.textContent ?? '', Number(text.getAttribute('font-size')), zoom);
  return { left: at.x - half.x, right: at.x + half.x, top: at.y - half.y, bottom: at.y + half.y };
}

function padBox(pad: SVGElement, transform: SceneTransform): Box {
  const n = (key: string) => Number(pad.getAttribute(key));
  if (pad.tagName === 'circle') {
    const at = sceneToScreenVector(transform, { x: n('cx'), y: n('cy') });
    return { left: at.x - n('r'), right: at.x + n('r'), top: at.y - n('r'), bottom: at.y + n('r') };
  }
  const [angle = 0, cx = 0, cy = 0] = (pad.getAttribute('transform')?.match(/[-\d.]+/g) ?? []).map(
    Number,
  );
  const radians = (angle * Math.PI) / 180;
  const corners = [
    [n('x'), n('y')],
    [n('x') + n('width'), n('y')],
    [n('x'), n('y') + n('height')],
    [n('x') + n('width'), n('y') + n('height')],
  ].map(([x, y]) =>
    sceneToScreenVector(transform, {
      x: cx + (x! - cx) * Math.cos(radians) - (y! - cy) * Math.sin(radians),
      y: cy + (x! - cx) * Math.sin(radians) + (y! - cy) * Math.cos(radians),
    }),
  );
  return {
    left: Math.min(...corners.map((p) => p.x)),
    right: Math.max(...corners.map((p) => p.x)),
    top: Math.min(...corners.map((p) => p.y)),
    bottom: Math.max(...corners.map((p) => p.y)),
  };
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
          const { container } = mount(
            {
              footprint,
              params: { pins: footprint === 'header1' ? 15 : 44 },
              center: { x: 500, y: 500 },
              rotationDeg,
              side,
              scaleX: scale,
              scaleY: scale,
              customPads: {},
            },
            zoom,
            transform,
            pxPerMm,
          );
          const texts = [
            ...container.querySelectorAll<SVGTextElement>('[data-layer="components.labels"] text'),
          ];
          const labels = texts.filter((text) =>
            ['J29 ?', 'LONG CONNECTOR VALUE'].includes(text.textContent ?? ''),
          );
          if (pxPerMm === 0.2) {
            // At this literal document scale the reference/value text is hidden.
            expect(labels).toHaveLength(0);
            cleanup();
            continue;
          }
          expect(labels).toHaveLength(2);
          const numbers = texts.filter((text) => /^\d+$/.test(text.textContent ?? ''));
          const pads = [
            ...container.querySelectorAll<SVGElement>(
              '[data-layer="components.pins"] [data-pin] > :first-child',
            ),
          ];
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
          cleanup();
        }
      }
    }
  }
}

test('auto_label_clears_own_pads_and_pin_numbers_under_all_8_transforms', () => {
  checkAutomatic('header1');
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
      const { container } = mount(board, 0.5, transform);
      const ref = [...container.querySelectorAll<SVGTextElement>('text')].find(
        (text) => text.textContent === 'J29 ?',
      )!;
      expect(Number(ref.getAttribute('x'))).toBe(500);
      expect(Number(ref.getAttribute('y'))).toBe(500);
      expect(board.labelOffset).toEqual(labelOffset);
      cleanup();
    }
});
