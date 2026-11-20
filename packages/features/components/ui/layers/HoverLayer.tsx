import type { BoardPlacement, Vec2 } from '@pcbk/domain';
import { boardPads, boardToPad, bodyOutline, padToBoard } from '@pcbk/domain/geometry';
import type { LayerSpec } from '@pcbk/ui';
import { selectComponent } from '../../contract';
import { useHoverStore } from '../hover-store';

function padOutline(
  board: BoardPlacement,
  pinIds: readonly string[],
  pxPerMm: number,
  zoom: number,
): Vec2[] {
  const pads = boardPads(board, pinIds, pxPerMm);
  if (pads.length === 0) return [];

  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  // Keep the outline aligned with the placement axes and enclose the rendered pads.
  const minHalf = 2.5 / zoom;
  for (const { at, halfPx } of pads) {
    const { x, y } = boardToPad(board, at, pxPerMm);
    const halfX = Math.max(halfPx.x, minHalf) / (board.scaleX * pxPerMm);
    const halfY = Math.max(halfPx.y, minHalf) / (board.scaleY * pxPerMm);
    left = Math.min(left, x - halfX);
    right = Math.max(right, x + halfX);
    top = Math.min(top, y - halfY);
    bottom = Math.max(bottom, y + halfY);
  }
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ].map((corner) => padToBoard(board, corner, pxPerMm));
}

function HoverLayer({ snapshot, zoom }: Parameters<LayerSpec['render']>[0]) {
  const componentId = useHoverStore((state) => state.componentId);
  if (componentId === null) return null;
  const component = selectComponent(snapshot, componentId);
  if (!component?.board) return null;
  const { board, pins } = component;
  const { pxPerMm } = snapshot.doc.scale;
  const body = bodyOutline(board, pxPerMm);
  const [a, b, c, d] =
    body.length > 0
      ? body
      : padOutline(
          board,
          pins.map(({ id }) => id),
          pxPerMm,
          zoom,
        );
  if (!a || !b || !c || !d) return null;

  // Expand the rectangle along its own axes, including when it is rotated or mirrored.
  const x = { x: b.x - a.x, y: b.y - a.y };
  const y = { x: d.x - a.x, y: d.y - a.y };
  const width = Math.hypot(x.x, x.y);
  const height = Math.hypot(y.x, y.y);
  if (width === 0 || height === 0) return null;
  const gap = 3 / zoom;
  const corners = [
    { point: a, sx: -1, sy: -1 },
    { point: b, sx: 1, sy: -1 },
    { point: c, sx: 1, sy: 1 },
    { point: d, sx: -1, sy: 1 },
  ];
  const points = corners.map(({ point, sx, sy }) => {
    const dx = gap * ((sx * x.x) / width + (sy * y.x) / height);
    const dy = gap * ((sx * x.y) / width + (sy * y.y) / height);
    return `${point.x + dx},${point.y + dy}`;
  });

  return (
    <g data-layer="components.hover" pointerEvents="none" aria-hidden="true">
      <polygon
        points={points.join(' ')}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeDasharray="5 4"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

export const HOVER_LAYER: LayerSpec = {
  id: 'components.hover',
  z: 90,
  render: (props) => <HoverLayer {...props} />,
};
