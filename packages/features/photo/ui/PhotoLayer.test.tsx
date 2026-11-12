// @vitest-environment jsdom
import { cleanup, render, act } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { EngineProvider } from '@pcbk/client';
import type { ProjectService } from '@pcbk/contracts';
import { idGenerator } from '../../__tests__/helpers';
import { uiFeatures } from '../../ui';
import { photoUiFixture } from '../__tests__/ui-fixture';
import { createPhotoUi } from './index';

const open: ProjectService[] = [];
afterEach(async () => {
  cleanup();
  for (const projects of open.splice(0)) await projects.discard();
});

async function fixture(withPhoto = true) {
  const { engine, projects, url } = photoUiFixture();
  open.push(projects);
  expect((await projects.create({ name: 'Foto' })).ok).toBe(true);
  if (withPhoto) {
    expect(
      engine.execute('photo.add', {
        photo: {
          id: 'pho_1',
          side: 'top',
          name: 'Plaat',
          widthPx: 4032,
          heightPx: 3024,
          transform: 'rot90',
        },
      }).ok,
    ).toBe(true);
  }
  const layer = createPhotoUi().canvasLayers![0]!;
  const view = render(
    <EngineProvider engine={engine} projects={projects}>
      <svg>{layer.render({ snapshot: engine.snapshot(), preview: null, zoom: 1 })}</svg>
    </EngineProvider>,
  );
  return { engine, projects, url, layer, view };
}

test('photo_layer_renders_display_url_at_original_size', async () => {
  const { projects, url, layer, view } = await fixture();
  expect(layer.id).toBe('photo.image');
  expect(layer.z).toBe(0);
  expect(layer.hits).toBeUndefined();
  const image = view.container.querySelector('image')!;
  expect(image.getAttribute('href')).toBe(projects.photoUrl('pho_1', 'display'));
  expect(url.mock.calls.at(-1)?.slice(1)).toEqual(['pho_1', 'display']);
  expect(image.getAttribute('x')).toBe('0');
  expect(image.getAttribute('y')).toBe('0');
  expect(image.getAttribute('width')).toBe('4032');
  expect(image.getAttribute('height')).toBe('3024');
  expect(image.getAttribute('preserveAspectRatio')).toBe('none');
  expect(image.getAttribute('pointer-events')).toBe('none');
  expect(image.getAttribute('style')).toContain('image-orientation: none');
  expect(
    uiFeatures(idGenerator(), () => undefined).find((module) => module.id === 'photo'),
  ).toBeDefined();
});

test('photo_layer_renders_nothing_without_photo', async () => {
  const { view, url } = await fixture(false);
  expect(view.container.querySelector('image')).toBeNull();
  expect(url).not.toHaveBeenCalled();
});

test('photo_layer_renders_nothing_with_null_url', async () => {
  const { projects, engine, layer, view } = await fixture();
  vi.spyOn(projects, 'photoUrl').mockReturnValue(null);
  view.rerender(
    <EngineProvider engine={engine} projects={projects}>
      <svg>{layer.render({ snapshot: engine.snapshot(), preview: null, zoom: 1 })}</svg>
    </EngineProvider>,
  );
  expect(view.container.querySelector('image')).toBeNull();
});

test('photo_layer_refreshes_url_when_copy_changes_storage_session', async () => {
  const { engine, projects, view } = await fixture();
  const before = view.container.querySelector('image')!.getAttribute('href');
  const snapshot = engine.snapshot();
  await act(async () => {
    expect((await projects.copy({ dest: 'copy.pcbk', identity: 'same' })).ok).toBe(true);
  });
  expect(engine.snapshot()).toBe(snapshot);
  const after = view.container.querySelector('image')!.getAttribute('href');
  expect(after).not.toBe(before);
  expect(after).toBe(projects.photoUrl('pho_1', 'display'));
});
