// @vitest-environment jsdom
import { render } from '@testing-library/react';
import type { Vec2 } from '@pcbk/domain';
import { describe, expect, it } from 'vitest';
import { SceneText } from './scene-text';
import {
  pointerWorld,
  sceneMatrix,
  sceneToScreenVector,
  screenToSceneVector,
  viewMatrix,
  zoomAt,
  type SceneTransform,
} from './stage';

type Matrix = [number, number, number, number, number, number];

function svgMatrix(attribute: string | null): Matrix {
  const values = attribute
    ?.match(/^matrix\(([^)]+)\)$/)?.[1]
    ?.split(/[ ,]+/)
    .map(Number);
  if (values?.length !== 6) throw new Error('Expected a six-value SVG matrix');
  return values as Matrix;
}

function apply([a, b, c, d, e, f]: Matrix, { x, y }: Vec2): Vec2 {
  return { x: a * x + c * y + e, y: b * x + d * y + f };
}

function installScreenCtm(scene: SVGElement, [a, b, c, d, e, f]: Matrix): void {
  // jsdom has no SVG layout. Supply a CTM with real affine inversion and point mapping.
  const det = a * d - b * c;
  const inverse = {
    a: d / det,
    b: -b / det,
    c: -c / det,
    d: a / det,
    e: (c * f - d * e) / det,
    f: (b * e - a * f) / det,
  };
  Object.defineProperty(scene, 'getScreenCTM', {
    value: () => ({ inverse: () => inverse }),
  });
}

const anchor = { x: 7, y: 11 };
const transforms: [SceneTransform, Vec2, Vec2][] = [
  ['none', { x: 7, y: 11 }, { x: 118.5, y: 84.5 }],
  ['rot90', { x: -11, y: 7 }, { x: 73.5, y: 74.5 }],
  ['rot180', { x: -7, y: -11 }, { x: 83.5, y: 29.5 }],
  ['rot270', { x: 11, y: -7 }, { x: 128.5, y: 39.5 }],
  ['mirror', { x: -7, y: 11 }, { x: 83.5, y: 84.5 }],
  ['mirror_rot90', { x: -11, y: -7 }, { x: 73.5, y: 39.5 }],
  ['mirror_rot180', { x: 7, y: -11 }, { x: 118.5, y: 29.5 }],
  ['mirror_rot270', { x: 11, y: 7 }, { x: 128.5, y: 74.5 }],
];

describe('scene stage', () => {
  it.each(transforms)('scene_bounds_start_at_origin_under_all_8_transforms (%s)', (transform) => {
    const surface = { width: 4000, height: 3000 };
    const matrix = svgMatrix(sceneMatrix(transform, surface));
    const corners = [
      { x: 0, y: 0 },
      { x: surface.width, y: 0 },
      { x: surface.width, y: surface.height },
      { x: 0, y: surface.height },
    ].map((point) => apply(matrix, point));
    const swapsAxes = transform.includes('90') || transform.includes('270');

    expect(Math.min(...corners.map(({ x }) => x))).toBe(0);
    expect(Math.min(...corners.map(({ y }) => y))).toBe(0);
    expect(Math.max(...corners.map(({ x }) => x))).toBe(swapsAxes ? 3000 : 4000);
    expect(Math.max(...corners.map(({ y }) => y))).toBe(swapsAxes ? 4000 : 3000);
  });

  it.each(transforms)('scene_vectors_follow_linear_transform_and_inverse (%s)', (transform, at) => {
    const actual = sceneToScreenVector(transform, anchor);
    expect(actual).toEqual(at);
    expect(screenToSceneVector(transform, actual)).toEqual(anchor);
  });

  it.each(transforms)(
    'scene_transform_keeps_text_readable_for_all_8_transforms (%s)',
    (sceneTransform, expectedAnchor) => {
      const { container } = render(
        <svg>
          <g transform={sceneMatrix(sceneTransform)}>
            <SceneText {...anchor} sceneTransform={sceneTransform} textAnchor="middle">
              R7
            </SceneText>
          </g>
        </svg>,
      );
      const text = container.querySelector('text')!;
      const parentMatrix = svgMatrix(text.parentElement!.getAttribute('transform'));
      const textMatrix = svgMatrix(text.getAttribute('transform'));
      const position = { x: Number(text.getAttribute('x')), y: Number(text.getAttribute('y')) };
      const toScene = (point: Vec2) => apply(parentMatrix, apply(textMatrix, point));

      expect(text.textContent).toBe('R7');
      expect(text.getAttribute('text-anchor')).toBe('middle');
      expect(toScene(position)).toEqual(expectedAnchor);
      expect(toScene({ x: position.x + 1, y: position.y })).toEqual({
        x: expectedAnchor.x + 1,
        y: expectedAnchor.y,
      });
      expect(toScene({ x: position.x, y: position.y + 1 })).toEqual({
        x: expectedAnchor.x,
        y: expectedAnchor.y + 1,
      });
    },
  );

  it.each(transforms)(
    'pointer_world_coords_correct_under_each_scene_transform (%s)',
    (sceneTransform, _expectedAnchor, screen) => {
      const { container } = render(
        <svg>
          <g transform={sceneMatrix(sceneTransform)} />
        </svg>,
      );
      const scene = container.querySelector<SVGGElement>('g')!;
      const [a, b, c, d] = svgMatrix(scene.getAttribute('transform'));
      // Combine the scene with a 2.5x viewport scale and screen-space translation.
      installScreenCtm(scene, [2.5 * a, 2.5 * b, 2.5 * c, 2.5 * d, 101, 57]);
      const actual = pointerWorld(scene, screen);

      expect(actual.x).toBeCloseTo(anchor.x);
      expect(actual.y).toBeCloseTo(anchor.y);
    },
  );

  it('wheel_zoom_keeps_cursor_point_fixed in SVG-root-local coordinates', () => {
    const view = { zoom: 2, pan: { x: 40, y: -50 } };
    const cursor = { x: 70, y: 14 };
    const next = zoomAt(view, cursor, 3.5);

    expect(next).toEqual({ zoom: 3.5, pan: { x: 17.5, y: -98 } });
    expect(apply(svgMatrix(viewMatrix(next)), { x: 15, y: 32 })).toEqual(cursor);
  });
});
