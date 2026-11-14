import { info } from '@tauri-apps/plugin-log';
import { boardPads } from '@pcbk/domain';
import { addPhoto } from '@pcbk/features/photo/ui';
import { et, useSessionStore, useViewStore } from '@pcbk/ui';
import type { Result, SaveStatus } from '@pcbk/contracts';
import type { createRuntime } from '../runtime';
import { frameStats } from './frame-stats';
import { generateSyntheticBoard } from './synthetic-board';
import { createSyntheticPhoto } from './synthetic-photo';
import {
  canvasCounts,
  formatResult,
  nextFrame,
  observeSvgPhoto,
  sampleFrames,
  showResult,
  trackForeground,
  waitFor,
} from './probe-dom';
import { dragComponent } from './probe-input';
import { awaitProbeReady, environment, failureResult, selectDenseTarget } from './probe-setup';

type Runtime = ReturnType<typeof createRuntime>;

function unwrap<T>(result: Result<T, unknown>, label: string): T {
  if (!result.ok) throw new Error(`${label}: ${JSON.stringify(result.error)}`);
  return result.value;
}

function button(label: string) {
  return (
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (item) =>
        (item.getAttribute('aria-label') === label || item.textContent?.trim() === label) &&
        !item.disabled &&
        !item.closest('fieldset[disabled]'),
    ) ?? null
  );
}

async function saveQuiet(runtime: Runtime) {
  let status: SaveStatus | undefined;
  const unsubscribe = runtime.projects.status((next) => {
    status = next;
  });
  try {
    unwrap(await runtime.projects.flush(), 'flush');
    await waitFor(() => status?.state === 'saved', 'quiet project save');
  } finally {
    unsubscribe();
  }
}

async function openWorkbench(runtime: Runtime, path: string) {
  const originalOpen = runtime.projects.open;
  let started = 0;
  let opening: ReturnType<Runtime['projects']['open']> | undefined;
  const photo = observeSvgPhoto();
  runtime.projects.open = (request) => {
    started = performance.now();
    opening = originalOpen.call(runtime.projects, request);
    return opening;
  };
  try {
    const open = await waitFor(() => button(et.project.open), 'home Open button');
    open.click();
    await waitFor(() => opening ?? false, 'projects.open invocation');
    const opened = unwrap(await opening!, 'open');
    if (opened.path !== path) throw new Error('Workbench opened the wrong project');
    const canvas = await waitFor(() => {
      const svg = document.querySelector<SVGSVGElement>(`svg[aria-label="${et.shell.canvas}"]`);
      return svg &&
        svg.querySelectorAll('[data-layer="components.bodies"] [data-component]').length === 300 &&
        photo.ready(svg)
        ? svg
        : null;
    }, 'all 300 component bodies and actual SVG photo load');
    await nextFrame();
    await nextFrame();
    const elapsed = performance.now() - started;
    await saveQuiet(runtime);
    return { elapsed, canvas };
  } finally {
    runtime.projects.open = originalOpen;
    photo.stop();
  }
}

async function closeWorkbench(runtime: Runtime) {
  await saveQuiet(runtime);
  (await waitFor(() => button(et.project.returnHome), 'Back Home button')).click();
  await waitFor(() => button(et.project.open), 'home after close');
  await nextFrame();
}

async function measure(runtime: Runtime) {
  let foreground: ReturnType<typeof trackForeground> | undefined;
  const originalPicker = runtime.appHost.pickProjectFile;
  let projectPath: string | undefined;
  try {
    await awaitProbeReady(() => button(et.project.open) !== null);
    foreground = trackForeground();
    const creationStart = performance.now();
    const created = unwrap(
      await runtime.projects.create({ name: 'Jõudlusproov (sünteetiline)' }),
      'create',
    );
    projectPath = created.path;
    await saveQuiet(runtime);
    const photo = await createSyntheticPhoto();
    unwrap(
      await addPhoto(new File([photo.bytes], photo.name, { type: 'image/jpeg' }), runtime),
      'addPhoto',
    );
    await saveQuiet(runtime);
    const synthetic = generateSyntheticBoard({
      seed: 127,
      ids: runtime.ids,
      at: '2026-01-01T00:00:00.000Z',
    });
    for (const component of synthetic.components)
      unwrap(runtime.engine.execute('components.add', component), 'components.add');
    await saveQuiet(runtime);
    for (const measurement of synthetic.measurements)
      unwrap(runtime.engine.execute('measurements.add', measurement), 'measurements.add');
    await saveQuiet(runtime);
    const creationMs = performance.now() - creationStart;
    unwrap(await runtime.projects.close(), 'close created project');
    runtime.appHost.pickProjectFile = async () => created.path;
    const openMs: number[] = [];
    let canvas: SVGSVGElement | undefined;
    for (let run = 0; run < 3; run++) {
      const opened = await openWorkbench(runtime, created.path);
      openMs.push(opened.elapsed);
      canvas = opened.canvas;
      if (run < 2) await closeWorkbench(runtime);
    }
    if (!canvas) throw new Error('Canvas missing after open');
    const snapshot = runtime.engine.snapshot();
    const target = selectDenseTarget(snapshot.doc.components, synthetic.surface);
    if (!target?.board) throw new Error('No placed drag target');
    const minimumRadius = Math.min(
      ...snapshot.doc.components.flatMap((component) =>
        component.board
          ? boardPads(
              component.board,
              component.pins.map((pin) => pin.id),
              snapshot.doc.scale.pxPerMm,
            ).map((pad) => pad.radiusPx)
          : [],
      ),
    );
    const baseZoom = Math.max(8 / (1.6 * snapshot.doc.scale.pxPerMm), 7 / minimumRadius) * 1.2;
    const center = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
    const boardCenter = target.board.center;
    const view = (zoom: number, dx = 0, dy = 0) => ({
      zoom,
      pan: {
        x: center.x - boardCenter.x * zoom + dx,
        y: center.y - boardCenter.y * zoom + dy,
      },
    });
    const setView = useViewStore.getState().setBoardView;
    useSessionStore.getState().setSelection({ items: [{ kind: 'component', id: target.id }] });
    setView(view(baseZoom));
    await waitFor(
      () => canvasCounts(canvas!).labels >= 3300,
      'component references and all 3000 pin numbers',
    );
    await nextFrame();
    await nextFrame();
    await saveQuiet(runtime);
    const pan = frameStats(
      await sampleFrames(180, (frame) =>
        setView(view(baseZoom, Math.sin(frame / 30) * 80, Math.cos(frame / 30) * 50)),
      ),
    );
    await saveQuiet(runtime);
    const zoom = frameStats(
      await sampleFrames(180, (frame) =>
        setView(view(baseZoom * (1 + 0.15 * Math.sin((frame / 180) * Math.PI * 2)))),
      ),
    );
    await saveQuiet(runtime);
    setView(view(baseZoom));
    await nextFrame();
    await nextFrame();
    await saveQuiet(runtime);
    const drag = await dragComponent(runtime, canvas, target.id);
    await saveQuiet(runtime);
    const reasons = foreground.reasons();
    return {
      valid: reasons.length === 0,
      invalidReasons: reasons,
      projectPath,
      seed: 127,
      creationMs,
      open: { runsMs: openMs, medianMs: [...openMs].sort((a, b) => a - b)[1]!, budgetMs: 1500 },
      pan: { ...pan, budgetFps: 60 },
      zoom: { ...zoom, budgetFps: 60 },
      drag: {
        ...frameStats(drag.intervals),
        budgetFps: 45,
        captureShim: drag.captureShim,
        committed: drag.committed,
        revDelta: drag.revDelta,
        previewFrames: drag.previewFrames,
      },
      ...environment(),
      dom: canvasCounts(canvas),
      baseZoom,
      target: { id: target.id, footprint: target.board.footprint, center: target.board.center },
    };
  } catch (error) {
    return failureResult(error, foreground?.reasons(), projectPath);
  } finally {
    runtime.appHost.pickProjectFile = originalPicker;
    foreground?.stop();
  }
}

export async function runPerfProbe(runtime: Runtime) {
  try {
    const result = await measure(runtime);
    const json = JSON.stringify(result);
    console.info(`[perf] ${json}`);
    await info(`[perf] ${json}`);
    showResult(formatResult(result));
  } catch (error) {
    console.error('[perf] probe/log failed', error);
    showResult(`Jõudlusproov ebaõnnestus: ${String(error)}`);
  }
}
