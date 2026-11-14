import { info } from '@tauri-apps/plugin-log';
import { et, useViewStore } from '@pcbk/ui';
import { nextFrame, trackForeground } from './probe-dom';
import { awaitProbeReady, environment, failureResult } from './probe-setup';
import { createPngFixture } from './png-photo';
import {
  createPngProject,
  openPngWorkbench,
  closePngWorkbench,
  probeButton,
  type PngRuntime,
} from './png-session';
import { exportPngRoute, type PngPreview, type PngRow } from './png-export';
import { observePngFont } from './png-font';

function showPngResults(result: unknown, previews: PngPreview[]) {
  const overlay = document.createElement('section');
  overlay.dataset.pngProbe = '';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '16px',
    zIndex: '2147483647',
    overflow: 'auto',
    padding: '16px',
    background: '#12251f',
    color: '#e5ffee',
    font: '12px monospace',
  });
  const heading = document.createElement('h2');
  heading.textContent = 'PNG proov · Escape sulgeb';
  overlay.append(heading);
  const grid = document.createElement('div');
  Object.assign(grid.style, { display: 'flex', gap: '16px', flexWrap: 'wrap' });
  for (const preview of previews) {
    const figure = document.createElement('figure');
    figure.style.margin = '0';
    const label = document.createElement('figcaption');
    label.textContent = preview.label;
    const image = new Image();
    image.src = preview.url;
    image.alt = preview.label;
    Object.assign(image.style, {
      maxWidth: '40vw',
      height: '34vh',
      objectFit: 'contain',
      display: 'block',
    });
    figure.append(label, image);
    grid.append(figure);
  }
  overlay.append(grid);
  const details = document.createElement('pre');
  details.textContent = JSON.stringify(result, null, 2);
  details.style.whiteSpace = 'pre-wrap';
  overlay.append(details);
  document.body.append(overlay);
  const close = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.stopImmediatePropagation();
    overlay.remove();
    for (const preview of previews) URL.revokeObjectURL(preview.url);
    window.removeEventListener('keydown', close, true);
  };
  window.addEventListener('keydown', close, true);
}

async function measurePng(runtime: PngRuntime, previews: PngPreview[]) {
  const rows: PngRow[] = [];
  const projectPaths: string[] = [];
  const fonts: unknown[] = [];
  let foreground: ReturnType<typeof trackForeground> | undefined;
  try {
    await awaitProbeReady(() => probeButton(et.project.open) !== null);
    foreground = trackForeground();
    for (const portrait of [false, true]) {
      const fixture = await createPngFixture(portrait);
      const path = await createPngProject(runtime, fixture, (created) =>
        projectPaths.push(created),
      );
      const source = await openPngWorkbench(runtime, path);
      const photo = runtime.engine.snapshot().doc.photos[0];
      if (!photo) throw new Error('Imported PhotoRef missing');
      try {
        fonts.push({ photo: fixture.kind, ...(await observePngFont(source)) });
      } catch (error) {
        fonts.push({ photo: fixture.kind, observation: 'unknown', error: String(error) });
      }
      for (const variant of ['display', 'original'] as const) {
        const sourceView =
          variant === 'display'
            ? { zoom: 1.7, pan: { x: 173, y: -89 } }
            : { zoom: 2.2, pan: { x: -231, y: 147 } };
        useViewStore.getState().setBoardView(sourceView);
        await nextFrame();
        await nextFrame();
        const url = runtime.projects.photoUrl(photo.id, variant);
        if (!url) throw new Error(`Photo URL missing: ${variant}`);
        for (const route of ['P1', 'P2-normal', 'P2-anonymous', 'P3'] as const) {
          rows.push({
            ...(await exportPngRoute({ route, variant, url, source, photo, fixture, previews })),
            sourceView,
          });
          await nextFrame();
        }
      }
      await closePngWorkbench(runtime);
    }
    const invalidReasons = foreground.reasons();
    return {
      valid: invalidReasons.length === 0,
      invalidReasons,
      rows,
      fonts,
      projectPaths,
      fixtureLayout: {
        componentCenters: 'raw photo pixel centers + 0.5',
        referenceLabels:
          '300px inward from body centers, outside centroid ROI; pin labels retained',
        centroidRoi: '300x300 unfiltered pixel difference',
      },
      windowOrigin: location.origin,
      ...environment(),
    };
  } catch (error) {
    return {
      ...failureResult(error, foreground?.reasons()),
      rows,
      fonts,
      projectPaths,
      windowOrigin: location.origin,
    };
  } finally {
    foreground?.stop();
  }
}

export async function runPngProbe(runtime: PngRuntime) {
  const previews: PngPreview[] = [];
  const result = await measurePng(runtime, previews);
  const json = JSON.stringify(result);
  console.info(`[png-probe] ${json}`);
  try {
    await info(`[png-probe] ${json}`);
  } catch (error) {
    console.error('[png-probe] log failed', error);
  }
  showPngResults(result, previews);
}
