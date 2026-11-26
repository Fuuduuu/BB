import type { Vec2 } from '@pcbk/domain';
import { SceneText, useSessionStore } from '@pcbk/ui';
import type { LayerSpec } from '@pcbk/ui';
import { selectComponent } from '../../contract';
import { ALIGN_TOOL_ID } from '../AlignTool';
import { useAlignStore } from '../align-store';
import { alignPinPosition } from '../align';
import { alignEt } from '../i18n/et';

function AlignGuide({
  pin,
  target,
  number,
  zoom,
}: {
  pin: Vec2;
  target: Vec2 | null;
  number: number;
  zoom: number;
}) {
  const half = 6 / zoom;
  const stroke = 'var(--sel)';
  return (
    <g>
      {target && (
        <>
          <line
            x1={pin.x}
            y1={pin.y}
            x2={target.x}
            y2={target.y}
            stroke={stroke}
            strokeDasharray="5 4"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <path
            data-align-target={number}
            d={`M${target.x - half},${target.y} H${target.x + half} M${target.x},${target.y - half} V${target.y + half}`}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
      <g data-align-pin={number}>
        <circle
          cx={pin.x}
          cy={pin.y}
          r={9 / zoom}
          fill="var(--panel)"
          stroke={stroke}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        <SceneText
          x={pin.x}
          y={pin.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11 / zoom}
          fontFamily="var(--f-mono)"
          fontWeight={700}
          fill="var(--ink)"
        >
          {number}
        </SceneText>
      </g>
    </g>
  );
}

function AlignLayer({ snapshot, zoom }: Parameters<LayerSpec['render']>[0]) {
  const active = useSessionStore((store) => store.toolId === ALIGN_TOOL_ID);
  const stage = useAlignStore((store) => store.stage);
  const cursor = useAlignStore((store) => store.cursor);
  if (!active || stage.step === 1) return null;
  const board = selectComponent(snapshot, stage.id)?.board;
  if (!board) return null;
  const { pxPerMm } = snapshot.doc.scale;
  const pinA = alignPinPosition(board, stage.pinA, pxPerMm);
  const pinB =
    stage.step === 4 || stage.step === 5 ? alignPinPosition(board, stage.pinB, pxPerMm) : undefined;
  if (!pinA) return null;
  return (
    <g data-layer="components.align" pointerEvents="none" aria-hidden="true">
      <AlignGuide
        pin={pinA}
        target={stage.step === 2 ? cursor : stage.targetA}
        number={1}
        zoom={zoom}
      />
      {pinB && (
        <AlignGuide
          pin={pinB}
          target={stage.step === 5 ? stage.targetB : cursor}
          number={2}
          zoom={zoom}
        />
      )}
    </g>
  );
}

export function AlignHint() {
  const active = useSessionStore((store) => store.toolId === ALIGN_TOOL_ID);
  const step = useAlignStore((store) => store.stage.step);
  const error = useAlignStore((store) => store.error);
  if (!active) return null;
  return (
    <span
      role="status"
      data-align-step={step}
      style={{ color: error ? 'var(--danger)' : undefined }}
    >
      {error ?? alignEt.steps[step]}
    </span>
  );
}

export const ALIGN_LAYER: LayerSpec = {
  id: 'components.align',
  z: 100,
  render: (props) => <AlignLayer {...props} />,
};
