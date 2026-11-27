import { expect, test } from 'vitest';
import type { ViewState } from './project-service';
import * as views from './view-state';

test('same_view_state_covers_every_field', () => {
  expect(views.sameViewState).toBeTypeOf('function');
  const base: Required<Omit<ViewState, 'schematicView'>> = structuredClone(
    views.DEFAULT_VIEW_STATE,
  );
  const changes = {
    navigatorWidth: 410,
    navigatorOpen: false,
    navigatorTab: 'measurements',
    contextWidth: 390,
    contextOpen: false,
    boardView: { zoom: 2, pan: { x: 12, y: -18 } },
    modules: { photo: { visible: false, opacity: 0.4 } },
  } satisfies Required<Omit<ViewState, 'schematicView'>>;
  expect(Object.keys(changes).sort()).toEqual(Object.keys(base).sort());
  expect(views.sameViewState(base, structuredClone(base))).toBe(true);
  for (const [key, value] of Object.entries(changes)) {
    expect(views.sameViewState(base, { ...base, [key]: value }), key).toBe(false);
  }
  for (const boardView of [
    { zoom: 2, pan: { x: 0, y: 0 } },
    { zoom: 1, pan: { x: 3, y: 0 } },
    { zoom: 1, pan: { x: 0, y: -7 } },
  ])
    expect(views.sameViewState(base, { ...base, boardView })).toBe(false);
  const modules = { photo: { visible: true, opacity: 0.6 }, future: { chosen: [1, 2] } };
  const reordered = { future: { chosen: [1, 2] }, photo: { opacity: 0.6, visible: true } };
  expect(views.sameViewState({ ...base, modules }, { ...base, modules: reordered })).toBe(true);
  expect(
    views.sameViewState(
      { ...base, modules },
      {
        ...base,
        modules: { ...modules, future: { chosen: [2, 1] } },
      },
    ),
  ).toBe(false);
});
