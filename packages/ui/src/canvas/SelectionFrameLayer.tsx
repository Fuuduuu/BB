import type { Preview } from '../shell/session-store';
import type { SelectionFrame } from '../shell/UiRegistry';
import { SELECT_FRAME_OWNER } from './SelectTool';

export function SelectionFrameLayer({ preview }: { preview: Preview | null }) {
  if (preview?.owner !== SELECT_FRAME_OWNER) return null;
  const { min, max } = preview.data as SelectionFrame;
  return (
    <rect
      data-selection-frame=""
      x={min.x}
      y={min.y}
      width={max.x - min.x}
      height={max.y - min.y}
      fill="var(--sel-fill)"
      stroke="var(--sel)"
      strokeDasharray="5 4"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
      aria-hidden="true"
    />
  );
}
