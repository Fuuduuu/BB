import type { Snapshot } from '@pcbk/contracts';
import type { BoardPlacement, Vec2 } from '@pcbk/domain';
import { boardPads, bodyOutline } from '@pcbk/domain/geometry';
import { screenToSceneVector } from '@pcbk/ui';
import type { HitItem, SceneTransform } from '@pcbk/ui';

export const LABEL_DRAG_OWNER = 'components.label';

function defaultLabelOffset(board: BoardPlacement, pxPerMm: number): Vec2 {
  const outline = bodyOutline(board, pxPerMm);
  let top = Infinity;
  let bottom = -Infinity;
  for (const { y } of outline) {
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  const height = outline.length === 0 ? 0 : bottom - top;
  return { x: 0, y: -(height / 2 + pxPerMm) };
}

export function componentLabelLayout(board: BoardPlacement, pxPerMm: number) {
  const offset = board.labelOffset ?? defaultLabelOffset(board, pxPerMm);
  const at = { x: board.center.x + offset.x, y: board.center.y + offset.y };
  const textSize = 1.6 * pxPerMm;
  return { at, offset, textSize, valueY: at.y + 1.2 * textSize };
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
    ).map(({ pinId, at, radiusPx }) => ({
      kind: 'pin',
      id: pinId,
      componentId: id,
      shape: { type: 'point', at, r: radiusPx },
      priority: 2,
    }));
  });
}

export function componentLabelHits(
  { doc }: Snapshot,
  zoom: number,
  transform: SceneTransform,
): HitItem[] {
  return doc.components.flatMap<HitItem>(({ id, board, ref, value, identified }) => {
    if (!board) return [];
    const { at, offset, textSize, valueY } = componentLabelLayout(board, doc.scale.pxPerMm);
    if (!isComponentLabelVisible(textSize, zoom)) return [];

    // Estimate the centered mono text bounds without reading layout from the DOM.
    const padding = 2 / zoom;
    const refWidth = Array.from(ref).length + (identified ? 0 : 2);
    const valueWidth = Array.from(value).length;
    const halfWidth = (Math.max(refWidth, valueWidth) * 0.7 * textSize) / 2 + padding;
    const top = -textSize / 2 - padding;
    const bottom = (value ? valueY - at.y : 0) + textSize / 2 + padding;
    const polygon = [
      { x: -halfWidth, y: top },
      { x: halfWidth, y: top },
      { x: halfWidth, y: bottom },
      { x: -halfWidth, y: bottom },
    ].map((corner) => {
      const delta = screenToSceneVector(transform, corner);
      return { x: at.x + delta.x, y: at.y + delta.y };
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
