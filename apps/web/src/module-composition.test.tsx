// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import type { ComponentProps, ReactElement } from 'react';
import type { Workbench } from '@pcbk/ui';

const assembly = vi.hoisted(() => ({ tree: undefined as unknown }));
vi.mock('react-dom/client', () => ({
  createRoot: () => ({
    render: (tree: unknown) => {
      assembly.tree = tree;
    },
  }),
}));
vi.mock('./runtime', () => ({ createRuntime: () => ({ ids: { newId: () => 'unused' } }) }));
vi.mock('../../desktop/src/runtime', () => ({
  createRuntime: () => ({ ids: { newId: () => 'unused' } }),
}));
vi.mock('./web-host', () => ({ createWebHost: () => ({ kind: 'web' }) }));

test.each(['web', 'desktop'])(
  '%s assembly checks the actual product module lists',
  async (platform) => {
    document.body.innerHTML = '<div id="root"></div>';
    if (platform === 'web') await import('./main');
    else await import('../../desktop/src/main');
    const tree = assembly.tree as ReactElement<{
      children: ReactElement<ComponentProps<typeof Workbench>>;
    }>;
    const props = tree.props.children.props;
    const modules = props.uiModules(() => {});
    expect(props.validateModules).toBeTypeOf('function');
    expect(() => props.validateModules!(modules)).not.toThrow();
    expect(() =>
      props.validateModules!(
        modules.map((module) =>
          module.id === 'components' ? { ...module, id: 'components-typo' } : module,
        ),
      ),
    ).toThrow(/Missing engine module.*components-typo.*Missing UI module.*components/);
    expect(() =>
      props.validateModules!([...modules, ...['guide', 'export'].map((id) => ({ id, title: id }))]),
    ).not.toThrow();
    expect(() => props.validateModules!([...modules, { id: 'home-feedback', title: '' }])).toThrow(
      /home-feedback/,
    );
  },
);
