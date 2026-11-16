import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { DEFAULT_VIEW_STATE, type ViewState } from '@pcbk/contracts';
import { projectSetup } from './__tests__/project-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

test('every_view_field_change_is_saved_and_reopened', async () => {
  const base: Required<ViewState> = structuredClone(DEFAULT_VIEW_STATE);
  const changes = {
    navigatorWidth: 410,
    navigatorOpen: false,
    navigatorTab: 'measurements',
    contextWidth: 390,
    contextOpen: false,
    boardView: { zoom: 1.75, pan: { x: -12, y: 28 } },
    modules: { photo: { visible: false, opacity: 0.35 }, components: { filter: 'unplaced' } },
  } satisfies Required<ViewState>;
  expect(Object.keys(changes).sort()).toEqual(Object.keys(base).sort());
  for (const [key, value] of Object.entries(changes)) {
    const { projects, engine, memory, path } = await projectSetup();
    try {
      projects.saveView(base);
      expect((await projects.flush()).ok, key).toBe(true);
      const before = engine.snapshot();
      const writes = memory.viewWrites;
      const changed = { ...base, [key]: value };
      projects.saveView(changed);
      expect((await projects.flush()).ok, key).toBe(true);
      expect(memory.viewWrites, key).toBe(writes + 1);
      expect((await projects.close()).ok, key).toBe(true);
      const opened = await projects.open({ path });
      expect(opened, key).toMatchObject({ ok: true, value: { view: changed } });
      expect(engine.snapshot().doc, key).toEqual(before.doc);
      expect(memory.documentWrites, key).toBe(0);
    } finally {
      await projects.close();
    }
  }
});
