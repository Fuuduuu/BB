import type { Result, SaveStatus } from '@pcbk/contracts';
import { et, useViewStore } from '@pcbk/ui';
import type { createRuntime } from '../runtime';
import { nextFrame, observeSvgPhoto, waitFor } from './probe-dom';

type Runtime = ReturnType<typeof createRuntime>;

export function unwrap<T>(result: Result<T, unknown>, label: string): T {
  if (!result.ok) throw new Error(`${label}: ${JSON.stringify(result.error)}`);
  return result.value;
}

export function button(label: string) {
  return (
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (item) =>
        (item.getAttribute('aria-label') === label || item.textContent?.trim() === label) &&
        !item.disabled &&
        !item.closest('fieldset[disabled]'),
    ) ?? null
  );
}

export async function saveQuiet(runtime: Runtime) {
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

export async function openWorkbench(runtime: Runtime, path: string) {
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
      return svg && photo.ready(svg) ? svg : null;
    }, 'actual SVG photo load');
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

export async function closeWorkbench(runtime: Runtime) {
  await saveQuiet(runtime);
  (await waitFor(() => button(et.project.returnHome), 'Back Home button')).click();
  await waitFor(() => button(et.project.open), 'home after close');
  await nextFrame();
}

export async function openSchematic() {
  useViewStore.getState().setActiveView('schematic');
  return waitFor(() => {
    const svg = document.querySelector<SVGSVGElement>(`svg[aria-label="${et.shell.canvas}"]`);
    return svg?.querySelector('[data-layer="schematic.symbols"]') &&
      useViewStore.getState().schematicView
      ? svg
      : null;
  }, 'rendered schematic canvas');
}
