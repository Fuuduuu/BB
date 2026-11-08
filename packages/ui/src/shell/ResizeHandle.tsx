import { useRef } from 'react';

export function ResizeHandle({
  label,
  width,
  min,
  max,
  side,
  onResize,
  controls,
}: {
  label: string;
  width: number;
  min: number;
  max: number;
  side: 'left' | 'right';
  onResize(width: number): void;
  controls: string;
}) {
  const start = useRef<{ x: number; width: number } | null>(null);
  const direction = side === 'left' ? 1 : -1;
  return (
    <div
      className="pcbk-resizer"
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-controls={controls}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          onResize(width + direction * (event.key === 'ArrowRight' ? 10 : -10));
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          onResize(event.key === 'Home' ? min : max);
        }
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        start.current = { x: event.clientX, width };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        if (start.current)
          onResize(start.current.width + direction * (event.clientX - start.current.x));
      }}
      onPointerUp={(event) => {
        start.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onLostPointerCapture={() => {
        start.current = null;
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
    />
  );
}
