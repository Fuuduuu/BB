export const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

export function observeSvgPhoto() {
  const states = new WeakMap<Element, string>();
  const record = (event: Event) => {
    if (event.target instanceof Element && event.target.matches('image[data-layer="photo.image"]'))
      states.set(event.target, event.type);
  };
  document.addEventListener('load', record, true);
  document.addEventListener('error', record, true);
  return {
    ready(canvas: SVGSVGElement) {
      const image = canvas.querySelector('image[data-layer="photo.image"]');
      if (!image) return false;
      const state = states.get(image);
      if (state === 'error') throw new Error('SVG photo load failed');
      if (state !== 'load') return false;
      if (image.getAttribute('width') !== '4000' || image.getAttribute('height') !== '3000')
        throw new Error('Synthetic SVG photo dimensions differ from 4000 × 3000');
      return true;
    },
    stop() {
      document.removeEventListener('load', record, true);
      document.removeEventListener('error', record, true);
    },
  };
}

export async function waitFor<T>(read: () => T | null | false, label: string, timeout = 30_000) {
  const start = performance.now();
  while (performance.now() - start < timeout) {
    const result = read();
    if (result) return result;
    await new Promise((resolve) => window.setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

export function canvasCounts(canvas: SVGSVGElement) {
  const count = (selector: string) => canvas.querySelectorAll(selector).length;
  return {
    elements: count('*'),
    bodies: count('[data-layer="components.bodies"] [data-component]'),
    pins: count('[data-layer="components.pins"] [data-pin]'),
    labels: count('[data-layer="components.labels"] text'),
    photos: count('[data-layer="photo.image"]'),
  };
}

export function trackForeground() {
  const invalid = new Set<string>();
  const check = () => {
    if (document.visibilityState !== 'visible') invalid.add('window_hidden');
    if (!document.hasFocus()) invalid.add('window_not_focused');
  };
  const blur = () => invalid.add('window_blurred');
  check();
  document.addEventListener('visibilitychange', check);
  window.addEventListener('blur', blur);
  return {
    reasons: () => {
      check();
      return [...invalid];
    },
    stop: () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('blur', blur);
    },
  };
}

export async function sampleFrames(count: number, update: (frame: number) => void) {
  const intervals: number[] = [];
  let previous = await nextFrame();
  for (let frame = 0; frame < count; frame++) {
    update(frame);
    const now = await nextFrame();
    intervals.push(now - previous);
    previous = now;
  }
  return intervals;
}

type PerfSummary = {
  valid: boolean;
  invalidReasons?: string[];
  creationMs?: number;
  open?: { medianMs: number; budgetMs: number };
  pan?: { fps: number; budgetFps: number };
  zoom?: { fps: number; budgetFps: number };
  drag?: { fps: number; budgetFps: number };
};

export function formatResult(result: PerfSummary) {
  const rows = [['Mõõdik', 'Tulemus', 'Eelarve', 'Kas peab']];
  const verdict = (passes: boolean) => (result.valid ? (passes ? 'Jah' : 'Ei') : 'Kehtetu');
  if (result.open)
    rows.push([
      'Avamine',
      `${result.open.medianMs.toFixed(1)} ms`,
      `< ${result.open.budgetMs} ms`,
      verdict(result.open.medianMs < result.open.budgetMs),
    ]);
  for (const [label, metric] of [
    ['Pan', result.pan],
    ['Suum', result.zoom],
    ['Lohistamine', result.drag],
  ] as const) {
    if (metric)
      rows.push([
        label,
        `${metric.fps.toFixed(1)} fps`,
        `≥ ${metric.budgetFps} fps`,
        verdict(metric.fps >= metric.budgetFps),
      ]);
  }
  const widths = rows[0]!.map((_, column) => Math.max(...rows.map((row) => row[column]!.length)));
  const table = rows
    .map((row) => row.map((cell, column) => cell.padEnd(widths[column]!)).join('  '))
    .join('\n');
  const status = result.valid
    ? 'Jõudlusproov'
    : `KEHTETU: ${result.invalidReasons?.join(', ') ?? 'proov ebaõnnestus'}`;
  const creation =
    result.creationMs === undefined
      ? ''
      : `\nLoomine: ${result.creationMs.toFixed(1)} ms (eelarveta)`;
  return `${status}\n\n${table}${creation}\n\n${JSON.stringify(result, null, 2)}`;
}

export function showResult(json: string) {
  const overlay = document.createElement('pre');
  overlay.dataset.perfResult = '';
  overlay.textContent = `${json}\n\nEscape sulgeb`;
  Object.assign(overlay.style, {
    position: 'fixed',
    right: '12px',
    bottom: '12px',
    zIndex: '2147483647',
    maxHeight: '65vh',
    maxWidth: '65vw',
    overflow: 'auto',
    padding: '16px',
    background: '#12251f',
    color: '#e5ffee',
    fontSize: '11px',
    whiteSpace: 'pre-wrap',
  });
  document.body.append(overlay);
  const close = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.stopImmediatePropagation();
    overlay.remove();
    window.removeEventListener('keydown', close, true);
  };
  window.addEventListener('keydown', close, true);
}
