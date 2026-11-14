export function frameStats(intervalsMs: number[]): {
  frames: number;
  fps: number;
  p95Ms: number;
  worstMs: number;
} {
  const frames = intervalsMs.length;
  if (frames === 0) return { frames: 0, fps: 0, p95Ms: 0, worstMs: 0 };
  const sorted = [...intervalsMs].sort((a, b) => a - b);
  const mean = intervalsMs.reduce((sum, interval) => sum + interval, 0) / frames;
  return {
    frames,
    fps: 1000 / mean,
    // Nearest-rank percentile: the 1-based rank is ceil(0.95 × sample count).
    p95Ms: sorted[Math.ceil(frames * 0.95) - 1]!,
    worstMs: sorted[frames - 1]!,
  };
}
