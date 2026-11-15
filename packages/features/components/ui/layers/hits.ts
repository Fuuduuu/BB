import type { Snapshot } from '@pcbk/contracts';
import type { BoardPlacement, Component, Vec2 } from '@pcbk/domain';
import { footprintGeometry } from '@pcbk/domain/footprints';
import { boardPads, bodyOutline } from '@pcbk/domain/geometry';
import { monoLabelHalf, screenToSceneVector } from '@pcbk/ui';
import type { HitItem, LabelObstacle, SceneTransform } from '@pcbk/ui';

export const LABEL_DRAG_OWNER = 'components.label';

function defaultLabelOffset(
  board: BoardPlacement,
  pxPerMm: number,
  hasValue: boolean,
  transform: SceneTransform,
  zoom: number,
): Vec2 {
  const up = screenToSceneVector(transform, { x: 0, y: -1 });
  const project = ({ x, y }: Vec2) => (x - board.center.x) * up.x + (y - board.center.y) * up.y;
  const outline = bodyOutline(board, pxPerMm);
  const bodyTop = Math.max(0, ...outline.map(project));
  const geometry = footprintGeometry(board.footprint, board.params);
  const pinIds = [
    ...(geometry?.pads.map(({ id }) => board.padMap?.[id] ?? id) ?? []),
    ...Object.keys(board.customPads),
  ];
  let padTop = -Infinity;
  for (const { at, halfPx, angleDeg, shape } of boardPads(board, pinIds, pxPerMm)) {
    const radians = (angleDeg * Math.PI) / 180;
    const halfHeight =
      shape === 'circle'
        ? halfPx.x
        : Math.abs(up.x * Math.cos(radians) + up.y * Math.sin(radians)) * halfPx.x +
          Math.abs(-up.x * Math.sin(radians) + up.y * Math.cos(radians)) * halfPx.y;
    padTop = Math.max(padTop, project(at) + halfHeight);
  }
  const valueOffset = hasValue ? 1.2 * 1.6 * pxPerMm : 0;
  const textHalfHeight = monoLabelHalf('', 1.6 * pxPerMm, zoom).y;
  // Keep the calibrated box clear of geometry and the body's center.
  // Area hits extend by 6 screen pixels; one more pixel keeps a body-center drag outside them.
  const distance = Math.max(
    Math.max(bodyTop, padTop) + valueOffset + textHalfHeight + 1 / zoom,
    valueOffset + textHalfHeight + 7 / zoom,
  );
  return { x: up.x * distance, y: up.y * distance };
}

export function componentLabelLayout(
  board: BoardPlacement,
  pxPerMm: number,
  hasValue = false,
  transform: SceneTransform = 'none',
  zoom = 1,
) {
  const offset = board.labelOffset ?? defaultLabelOffset(board, pxPerMm, hasValue, transform, zoom);
  const at = { x: board.center.x + offset.x, y: board.center.y + offset.y };
  const textSize = 1.6 * pxPerMm;
  const valueOffset = screenToSceneVector(transform, { x: 0, y: 1.2 * textSize });
  const valueAt = { x: at.x + valueOffset.x, y: at.y + valueOffset.y };
  return { at, offset, textSize, valueAt, valueY: valueAt.y };
}

export function componentLabelBox(
  component: Pick<Component, 'id' | 'ref' | 'value' | 'identified'> & { board: BoardPlacement },
  pxPerMm: number,
  zoom: number,
  transform: SceneTransform,
) {
  const { id, ref, value, identified, board } = component;
  const layout = componentLabelLayout(board, pxPerMm, Boolean(value), transform, zoom);
  const { at, textSize } = layout;
  const refHalf = monoLabelHalf(`${ref}${identified ? '' : ' ?'}`, textSize, zoom);
  const valueHalf = value ? monoLabelHalf(value, textSize, zoom) : null;
  const halfWidth = Math.max(refHalf.x, valueHalf?.x ?? 0);
  const top = -refHalf.y;
  const bottom = Math.max(refHalf.y, valueHalf ? 1.2 * textSize + valueHalf.y : 0);
  const centerOffset = screenToSceneVector(transform, { x: 0, y: (top + bottom) / 2 });
  const box: LabelObstacle = {
    owner: LABEL_DRAG_OWNER,
    componentId: id,
    center: { x: at.x + centerOffset.x, y: at.y + centerOffset.y },
    half: { x: halfWidth, y: (bottom - top) / 2 },
  };
  return { ...layout, box };
}

export function isComponentLabelVisible(textSize: number, zoom: number): boolean {
  return textSize * zoom >= 8;
}

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
      shape:
        shape !== 'circle'
          ? { type: 'rect', at, half: halfPx, angleDeg }
          : { type: 'point', at, r: halfPx.x },
      priority: 2,
    }));
  });
}

export function componentLabelHits(
  { doc }: Snapshot,
  zoom: number,
  transform: SceneTransform,
): HitItem[] {
  return doc.components.flatMap<HitItem>((component) => {
    const { id, board } = component;
    if (!board) return [];
    const { offset, textSize, box } = componentLabelBox(
      { ...component, board },
      doc.scale.pxPerMm,
      zoom,
      transform,
    );
    if (!isComponentLabelVisible(textSize, zoom)) return [];

    const polygon = [
      { x: -box.half.x, y: -box.half.y },
      { x: box.half.x, y: -box.half.y },
      { x: box.half.x, y: box.half.y },
      { x: -box.half.x, y: box.half.y },
    ].map((corner) => {
      const delta = screenToSceneVector(transform, corner);
      return { x: box.center.x + delta.x, y: box.center.y + delta.y };
    });
    return [
      {
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
      },
    ];
  });
}

export function componentLabelObstacles(
  { doc }: Snapshot,
  zoom: number,
  transform: SceneTransform,
): LabelObstacle[] {
  return doc.components.flatMap((component) => {
    if (!component.board) return [];
    const { box, textSize } = componentLabelBox(
      { ...component, board: component.board },
      doc.scale.pxPerMm,
      zoom,
      transform,
    );
    return isComponentLabelVisible(textSize, zoom) ? [box] : [];
  });
}
