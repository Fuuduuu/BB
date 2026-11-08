import { expect, test } from 'vitest';
import { UiRegistry, type UiModule } from './UiRegistry';

const render = () => null;
const module = (id: string): UiModule => ({ id, title: id });

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
        { id: 'all', order: 1, appliesTo: ['component', 'none'], render },
      ],
      topBar: [{ id: 'top', render }],
      bottomBar: [{ id: 'bottom', render }],
    },
  ]);
  expect(registry.navigatorTabs().map(({ id }) => id)).toEqual(['first', 'later']);
  expect(registry.contextSections({ kind: 'component', id: 'cmp_1' }).map(({ id }) => id)).toEqual([
    'all',
    'component',
  ]);
  expect(registry.contextSections({ kind: 'none' }).map(({ id }) => id)).toEqual(['all']);
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
