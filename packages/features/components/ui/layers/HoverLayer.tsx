import { bodyOutline } from '@pcbk/domain/geometry';
import type { LayerSpec } from '@pcbk/ui';
import { selectComponent } from '../../contract';
import { useHoverStore } from '../hover-store';

function HoverLayer({ snapshot, zoom }: Parameters<LayerSpec['render']>[0]) {
  const componentId = useHoverStore((state) => state.componentId);
  if (componentId === null) return null;
  const board = selectComponent(snapshot, componentId)?.board;
  if (!board) return null;
  const [a, b, c, d] = bodyOutline(board, snapshot.doc.scale.pxPerMm);
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
