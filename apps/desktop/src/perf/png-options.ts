/** Only the acceptance probe uses the optional 48 MP run. */
export function pngProbeOptions(value?: string) {
  if (value && value !== '8000x6000') throw new Error(`Unsupported PNG probe size: ${value}`);
  const large = value === '8000x6000';
  return {
    size: large ? { width: 8000, height: 6000 } : { width: 4000, height: 3000 },
    portraits: large ? [false] : [false, true],
    variants: large ? (['original'] as const) : (['display', 'original'] as const),
    routes: large ? (['P3'] as const) : (['P1', 'P2-normal', 'P2-anonymous', 'P3'] as const),
  };
}
