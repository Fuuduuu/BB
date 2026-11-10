import { expect, test } from 'vitest';
import { UiRegistry, type KeySpec, type UiModule } from './UiRegistry';

test('context_section_applies_only_when_all_items_match', () => {
  const registry = new UiRegistry([
    {
      id: 'context',
      title: 'Context',
      contextSections: [
        { id: 'component-only', order: 1, appliesTo: ['component'], render },
        { id: 'parts', order: 2, appliesTo: ['component', 'pin'], render },
      ],
    },
  ]);
  expect(registry.contextSections({ items: [] })).toEqual([]);
  expect(
    registry
      .contextSections({
        items: [
          { kind: 'component', id: 'cmp_1' },
          { kind: 'pin', id: '2', componentId: 'cmp_2' },
        ],
      })
      .map(({ id }) => id),
  ).toEqual(['parts']);
  expect(
    registry.contextSections({
      items: [
        { kind: 'component', id: 'cmp_1' },
        { kind: 'future-kind', id: 'item_1' },
      ],
    }),
  ).toEqual([]);
});

test('layers are ordered by z and tool and layer ids are unique', () => {
  const tool = {
    id: 'measure',
    label: 'Measure',
    icon: '',
    group: 'measure' as const,
    create: () => {
      throw new Error('The registry should not create tools');
    },
  };
  const registry = new UiRegistry([
    { ...module('back'), canvasLayers: [{ id: 'back', z: 3, render }], tools: [tool] },
    { ...module('front'), canvasLayers: [{ id: 'front', z: -2, render }] },
  ]);
  expect(registry.canvasLayers().map(({ id }) => id)).toEqual(['front', 'back']);
  expect(registry.tools().map(({ id }) => id)).toEqual(['measure']);
  expect(() =>
    registry.register({ ...module('collision'), canvasLayers: [{ id: 'back', z: 1, render }] }),
  ).toThrow(/back/);
  expect(() => registry.register({ ...module('collision'), tools: [tool] })).toThrow(/measure/);
  expect(() =>
    registry.register({ ...module('collision'), tools: [{ ...tool, id: 'pan' }] }),
  ).toThrow(/pan/);
  expect(registry.modules().map(({ id }) => id)).toEqual(['back', 'front']);
});

const render = () => null;
const module = (id: string): UiModule => ({ id, title: id });

test('module_key_conflict_fails_registration', () => {
  const key = (id: string, letter: string, shift?: boolean): KeySpec => ({
    id,
    key: letter,
    shift,
    run: () => true,
  });
  const measure = {
    id: 'measure',
    label: 'Measure',
    icon: '',
    group: 'measure' as const,
    key: 'M',
    create: () => {
      throw new Error('The registry should not create tools');
    },
  };
  const registry = new UiRegistry([
    { ...module('components'), keys: [key('rotate', 'R'), key('reverse', 'r', true)] },
    { ...module('measurements'), tools: [measure] },
  ]);
  for (const letter of ['r', 'v', 'H', 'm']) {
    expect(() =>
      registry.register({ ...module('conflict'), keys: [key('duplicate', letter, false)] }),
    ).toThrow();
  }
  expect(() =>
    registry.register({ ...module('conflict'), keys: [key('duplicate', 'R', true)] }),
  ).toThrow();
  expect(() =>
    registry.register({
      ...module('conflict'),
      tools: [{ ...measure, id: 'custom', key: 'r' }],
    }),
  ).toThrow();
  registry.register({ ...module('shifted'), keys: [key('shifted-pan', 'h', true)] });
  expect(registry.keys().map(({ id }) => id)).toEqual(['rotate', 'reverse', 'shifted-pan']);
});

test('registers UI modules and rejects duplicate module ids without changing the registry', () => {
  const registry = new UiRegistry([module('project')]);
  expect(registry.modules().map(({ id }) => id)).toEqual(['project']);
  expect(() => registry.register(module('project'))).toThrow(/project/);
  expect(registry.modules()).toHaveLength(1);
});

test('collects contributions by order and context sections by selected object kind', () => {
  const registry = new UiRegistry([
    {
      ...module('components'),
      navigatorTabs: [
        { id: 'later', title: 'Later', order: 20, render },
        { id: 'first', title: 'First', order: 1, render },
      ],
      contextSections: [
        { id: 'component', order: 20, appliesTo: ['component'], render },
        { id: 'all', order: 1, appliesTo: ['component', 'pin'], render },
      ],
      topBar: [{ id: 'top', render }],
      bottomBar: [{ id: 'bottom', render }],
    },
  ]);
  expect(registry.navigatorTabs().map(({ id }) => id)).toEqual(['first', 'later']);
  expect(
    registry.contextSections({ items: [{ kind: 'component', id: 'cmp_1' }] }).map(({ id }) => id),
  ).toEqual(['all', 'component']);
  expect(registry.contextSections({ items: [] })).toEqual([]);
  expect(registry.topBar()).toHaveLength(1);
  expect(registry.bottomBar()).toHaveLength(1);
});

test('a contribution id conflict rejects the whole module atomically', () => {
  const registry = new UiRegistry([
    { ...module('project'), navigatorTabs: [{ id: 'parts', title: 'Parts', render }] },
  ]);
  expect(() =>
    registry.register({
      ...module('components'),
      topBar: [{ id: 'unique', render }],
      navigatorTabs: [{ id: 'parts', title: 'Other', render }],
    }),
  ).toThrow(/parts/);
  expect(registry.modules()).toHaveLength(1);
  expect(registry.topBar()).toHaveLength(0);
});

test('duplicate contributions within a single module are rejected too', () => {
  expect(
    () =>
      new UiRegistry([
        {
          ...module('project'),
          bottomBar: [
            { id: 'status', render },
            { id: 'status', render },
          ],
        },
      ]),
  ).toThrow(/status/);
});

test('duplicate pinned section ids reject registration', () => {
  const pinned = { id: 'measure', order: 1, useVisible: () => true, render };
  const registry = new UiRegistry([{ ...module('first'), contextPinned: [pinned] }]);
  expect(() => registry.register({ ...module('second'), contextPinned: [pinned] })).toThrow(
    /measure/,
  );
  expect(registry.modules().map(({ id }) => id)).toEqual(['first']);
});

test('caller changes and result-array changes cannot corrupt registered contribution ids', () => {
  const input: UiModule = {
    ...module('project'),
    navigatorTabs: [{ id: 'parts', title: 'Parts', render }],
  };
  const registry = new UiRegistry([input]);
  input.id = 'changed';
  input.navigatorTabs![0]!.id = 'changed';
  registry.navigatorTabs().pop();
  expect(registry.modules()[0]?.id).toBe('project');
  expect(registry.navigatorTabs()[0]?.id).toBe('parts');
  expect(() => registry.register(module('project'))).toThrow();
});
