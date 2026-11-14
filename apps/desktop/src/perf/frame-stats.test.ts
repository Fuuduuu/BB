import { expect, test } from 'vitest';
import { frameStats } from './frame-stats';

test('frame_stats_report_fps_p95_and_worst', () => {
  const intervals = [40, 10, 20, 30];
  expect(frameStats(intervals)).toEqual({ frames: 4, fps: 40, p95Ms: 40, worstMs: 40 });
  expect(intervals).toEqual([40, 10, 20, 30]);
  expect(frameStats(Array.from({ length: 20 }, (_, index) => 20 - index))).toEqual({
    frames: 20,
    fps: 1000 / 10.5,
    p95Ms: 19,
    worstMs: 20,
  });
  expect(frameStats([16])).toEqual({ frames: 1, fps: 62.5, p95Ms: 16, worstMs: 16 });
  expect(frameStats([])).toEqual({ frames: 0, fps: 0, p95Ms: 0, worstMs: 0 });
});
