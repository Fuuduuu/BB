import { addPhoto } from '@pcbk/features/photo/ui';
import { COMPONENT_LIBRARY, makePlacedComponent } from '@pcbk/features/components/contract';
import { et, useSessionStore, useViewStore } from '@pcbk/ui';
import type { Result, SaveStatus } from '@pcbk/contracts';
import type { createRuntime } from '../runtime';
import type { PngFixture } from './png-photo';
import { nextFrame, waitFor } from './probe-dom';

export type PngRuntime = ReturnType<typeof createRuntime>;
export function unwrap<T>(result: Result<T, unknown>, label: string): T {
  if (!result.ok) throw new Error(`${label}: ${JSON.stringify(result.error)}`);
  return result.value;
}
export function probeButton(label: string) {
  return (
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (item) =>
        (item.getAttribute('aria-label') === label || item.textContent?.trim() === label) &&
        !item.disabled &&
        !item.closest('fieldset[disabled]'),
    ) ?? null
  );
}
export async function flushPngProject(runtime: PngRuntime) {
  let status: SaveStatus | undefined;
  const unsubscribe = runtime.projects.status((next) => {
    status = next;
  });
  try {
    unwrap(await runtime.projects.flush(), 'flush');
    await waitFor(() => status?.state === 'saved', 'saved probe project');
  } finally {
    unsubscribe();
  }
}

export async function createPngProject(
  runtime: PngRuntime,
  fixture: PngFixture,
  onCreated: (path: string) => void,
) {
  const created = unwrap(
    await runtime.projects.create({ name: `PNG proov ${fixture.kind}` }),
    'create',
  );
  onCreated(created.path);
  await flushPngProject(runtime);
  unwrap(
    await addPhoto(new File([fixture.bytes], fixture.name, { type: 'image/jpeg' }), runtime),
    'addPhoto',
  );
  for (const [key, libraryId, ref] of [
    ['resistor', 'r_smd', 'R1'],
    ['soic', 'soic', 'U1'],
  ] as const) {
    const entry = COMPONENT_LIBRARY.find((item) => item.id === libraryId);
    if (!entry) throw new Error(`Missing ${libraryId}`);
    const component = makePlacedComponent(runtime.ids, entry, {}, fixture.centers[key]);
    unwrap(runtime.engine.execute('components.add', { ...component, ref }), 'components.add');
    // Keep actual reference text in the scene, outside the fixed 300px centroid ROI.
    const inward = key === 'resistor' ? 300 : -300;
    unwrap(
      runtime.engine.execute('components.setLabelOffset', {
        id: component.id,
        offset: fixture.exif === 6 ? { x: inward, y: 0 } : { x: 0, y: inward },
      }),
      'components.setLabelOffset',
    );
  }
  await flushPngProject(runtime);
  unwrap(await runtime.projects.close(), 'close fixture');
  return created.path;
}

export async function openPngWorkbench(runtime: PngRuntime, path: string) {
  const originalPicker = runtime.appHost.pickProjectFile;
  const originalOpen = runtime.projects.open;
  let opening: ReturnType<PngRuntime['projects']['open']> | undefined;
  const loaded = new WeakSet<Element>();
  const load = (event: Event) => {
    if (event.target instanceof Element && event.target.matches('image[data-layer="photo.image"]'))
      loaded.add(event.target);
  };
  document.addEventListener('load', load, true);
  runtime.appHost.pickProjectFile = async () => path;
  runtime.projects.open = (request) => {
    opening = originalOpen.call(runtime.projects, request);
    return opening;
  };
  try {
    (await waitFor(() => probeButton(et.project.open), 'home Open')).click();
    await waitFor(() => opening ?? false, 'projects.open');
    if (unwrap(await opening!, 'open').path !== path) throw new Error('Wrong probe project');
    const canvas = await waitFor(() => {
      const svg = document.querySelector<SVGSVGElement>(`svg[aria-label="${et.shell.canvas}"]`);
      const image = svg?.querySelector('image[data-layer="photo.image"]');
      return svg &&
        image &&
        loaded.has(image) &&
        svg.querySelectorAll('[data-layer="components.bodies"] [data-component]').length === 2
        ? svg
        : null;
    }, 'actual SVG photo and two bodies');
    useSessionStore.getState().setSelection({ items: [] });
    // Actual DOM is rendered under a displaced, zoomed view; clone must discard it.
    useViewStore.getState().setBoardView({ zoom: 1.7, pan: { x: 173, y: -89 } });
    await nextFrame();
    await nextFrame();
    return canvas;
  } finally {
    runtime.appHost.pickProjectFile = originalPicker;
    runtime.projects.open = originalOpen;
    document.removeEventListener('load', load, true);
  }
}

export async function closePngWorkbench(runtime: PngRuntime) {
  await flushPngProject(runtime);
  (await waitFor(() => probeButton(et.project.returnHome), 'Back Home')).click();
  await waitFor(() => probeButton(et.project.open), 'Home after probe');
  await nextFrame();
}
