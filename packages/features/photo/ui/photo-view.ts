export interface PhotoView {
  visible: boolean;
  opacity: number;
  contrast: number;
  gray: boolean;
}

function finiteRange(value: unknown, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : 1;
}

export function readPhotoView(value: unknown): PhotoView {
  const fields =
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    visible: typeof fields.visible === 'boolean' ? fields.visible : true,
    opacity: finiteRange(fields.opacity, 0.1, 1),
    contrast: finiteRange(fields.contrast, 0.5, 2),
    gray: typeof fields.gray === 'boolean' ? fields.gray : false,
  };
}
