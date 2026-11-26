import type { Snapshot } from '@pcbk/contracts';
import { boardPads, bodyOutline } from '@pcbk/domain/geometry';
import { screenToSceneVector } from '@pcbk/ui';
import type { HitItem, LabelObstacle, SceneTransform } from '@pcbk/ui';
import {
  componentLabelPlacements,
  isComponentLabelVisible,
  LABEL_DRAG_OWNER,
} from './label-placement';

export { componentLabelBox, componentLabelLayout, LABEL_DRAG_OWNER } from './label-placement';

export function componentBodyHits({ doc }: Snapshot): HitItem[] {
  return doc.components.flatMap<HitItem>(({ id, board }) => {
    if (!board) return [];
    const polygon = bodyOutline(board, doc.scale.pxPerMm);
    if (polygon.length === 0) return [];
    return [{ kind: 'component', id, shape: { type: 'area', polygon }, priority: 0 }];
  });
}

export function componentPinHits({ doc }: Snapshot): HitItem[] {
  return doc.components.flatMap<HitItem>(({ id, board, pins }) => {
    if (!board) return [];
    return boardPads(
      board,
      pins.map((pin) => pin.id),
      doc.scale.pxPerMm,
    ).map<HitItem>(({ pinId, at, halfPx, angleDeg, shape }) => ({
      kind: 'pin',
      id: pinId,
      componentId: id,
      moves: { kind: 'component', id },
      shape:
        shape === 'circle' && halfPx.x === halfPx.y
          ? { type: 'point', at, r: halfPx.x }
          : {
              type: 'rect',
              at,
              half: halfPx,
              angleDeg,
              ...(shape === 'oval' && { corner: 'round' as const }),
              ...(shape === 'circle' && { corner: 'ellipse' as const }),
            },
      priority: 2,
    }));
  });
}

export function componentLabelHits(
  { doc }: Snapshot,
  zoom: number,
  transform: SceneTransform,
): HitItem[] {
  const hits: HitItem[] = [];
  for (const [id, { offset, textSize, box }] of componentLabelPlacements(doc, zoom, transform)) {
    if (!isComponentLabelVisible(textSize, zoom)) continue;

    const polygon = [
      { x: -box.half.x, y: -box.half.y },
      { x: box.half.x, y: -box.half.y },
      { x: box.half.x, y: box.half.y },
      { x: -box.half.x, y: box.half.y },
    ].map((corner) => {
      const delta = screenToSceneVector(transform, corner);
      return { x: box.center.x + delta.x, y: box.center.y + delta.y };
    });
    hits.push({
      kind: 'component-label',
      id,
      componentId: id,
      shape: { type: 'area', polygon },
      priority: 1,
      target: { kind: 'component', id },
      drag: {
        owner: LABEL_DRAG_OWNER,
        commit({ x, y }, api) {
          api.execute('components.setLabelOffset', {
            id,
            offset: { x: offset.x + x, y: offset.y + y },
          });
        },
      },
    });
  }
  return hits;
}

export function componentLabelObstacles(
  { doc }: Snapshot,
  zoom: number,
  transform: SceneTransform,
): LabelObstacle[] {
  const obstacles: LabelObstacle[] = [];
  for (const { box, textSize } of componentLabelPlacements(doc, zoom, transform).values()) {
    if (isComponentLabelVisible(textSize, zoom)) obstacles.push(box);
  }
  return obstacles;
}
