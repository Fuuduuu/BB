import { SceneText, useSessionStore } from '@pcbk/ui';
import type { LayerSpec } from '@pcbk/ui';
import { CALIBRATE_TOOL_ID } from './CalibrateTool';
import { useCalibrateStore } from './calibrate-store';
import { photoEt } from './i18n/et';

export function CalibrationLayer({ zoom }: Parameters<LayerSpec['render']>[0]) {
  const toolId = useSessionStore((store) => store.toolId);
  const { a, b, cursor, error } = useCalibrateStore();
  if (toolId !== CALIBRATE_TOOL_ID || !a) return null;
  const end = b ?? cursor;
  const points = [
    { point: a, label: photoEt.calibration.pointA },
    ...(end ? [{ point: end, label: photoEt.calibration.pointB }] : []),
  ];
  const textStyle = {
    fontSize: 12 / zoom,
    fontFamily: 'var(--f-mono)',
    fill: 'var(--ink)',
    stroke: 'var(--halo)',
    strokeWidth: 3 / zoom,
    paintOrder: 'stroke' as const,
  };

  return (
    <g data-layer="photo.calibration" pointerEvents="none">
      {end && (
        <line
          x1={a.x}
          y1={a.y}
          x2={end.x}
          y2={end.y}
          stroke="var(--accent)"
          strokeWidth={1.5 / zoom}
        />
      )}
      {points.map(({ point, label }) => (
        <g key={label}>
          <circle
            cx={point.x}
            cy={point.y}
            r={4 / zoom}
            fill="var(--panel)"
            stroke="var(--accent)"
            strokeWidth={1.5 / zoom}
          />
          <SceneText x={point.x} y={point.y} dx={8 / zoom} dy={-8 / zoom} {...textStyle}>
            {label}
          </SceneText>
        </g>
      ))}
      {!b && error && (
        <SceneText x={a.x} y={a.y} dx={8 / zoom} dy={24 / zoom} {...textStyle}>
          {error}
        </SceneText>
      )}
    </g>
  );
}

export const PHOTO_CALIBRATION_LAYER: LayerSpec = {
  id: 'photo.calibration',
  z: 90,
  render: (props) => <CalibrationLayer {...props} />,
};
