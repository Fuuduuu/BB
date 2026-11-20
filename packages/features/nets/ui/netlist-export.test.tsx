// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { EngineProvider } from '@pcbk/client';
import type { AppHost } from '@pcbk/contracts';
import { expect, test, vi } from 'vitest';
import { createWebHost } from '../../../../apps/web/src/web-host';
import { FakeProjects } from '../../../client/src/__tests__/fakes';
import { idGenerator, setup } from '../../__tests__/helpers';
import { measurementDoc } from '../../measurements/__tests__/workspace';
import { uiFeatures } from '../../ui';
import { netlistCsv } from '../contract';

test('netlist_export_saves_csv_file', async () => {
  const doc = measurementDoc();
  doc.name = 'Sünteetiline \\/:*?"<>|plaat';
  doc.connections.push({
    id: 'con_test',
    a: { pin: { c: 'cmp_u1', p: '1' } },
    b: { pin: { c: 'cmp_u1', p: '2' } },
    basis: 'assumed',
  });
  const { engine, host } = setup(doc);
  const projects = new FakeProjects();
  const ids = idGenerator();
  const button = () =>
    screen.getByRole<HTMLButtonElement>('button', { name: 'Ekspordi võrguloend (CSV)' });
  function mount(saveTextFile?: AppHost['saveTextFile'], withNets = true) {
    host.load('netlist-export-test', withNets ? doc : { ...doc, connections: [] }, false);
    const tab = uiFeatures(ids, () => {}, { saveTextFile }).find((module) => module.id === 'nets')!
      .navigatorTabs![0]!;
    return render(
      <EngineProvider engine={engine} projects={projects}>
        {tab.render()}
      </EngineProvider>,
    );
  }

  const fileName = 'Sünteetiline plaat võrguloend.csv';
  const saveTextFile = vi.fn<NonNullable<AppHost['saveTextFile']>>().mockResolvedValue('saved');
  const mounted = mount(saveTextFile);
  const csv = netlistCsv(engine.snapshot());
  expect(button().disabled).toBe(false);
  fireEvent.click(button());
  expect(saveTextFile).toHaveBeenCalledExactlyOnceWith(fileName, csv);
  saveTextFile.mockRejectedValueOnce(new Error('write failed'));
  fireEvent.click(button());
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Võrguloendi salvestamine ebaõnnestus',
  );
  mounted.unmount();

  const withoutMethod = mount();
  expect(button().disabled).toBe(true);
  withoutMethod.unmount();
  const withoutNets = mount(saveTextFile, false);
  expect(button().disabled).toBe(true);
  withoutNets.unmount();

  const web = createWebHost({
    listProjects: async () => [],
    recents: () => [],
    removeRecent: () => {},
  });
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:netlist');
  const revokeObjectURL = vi.fn();
  vi.useFakeTimers();
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }));
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  try {
    expect(await web.saveTextFile?.(fileName, csv)).toBe('saved');
    expect(click).toHaveBeenCalledOnce();
    const download = click.mock.contexts[0] as HTMLAnchorElement | undefined;
    expect(download?.download).toBe(fileName);
    expect(download?.href).toBe('blob:netlist');
    const blob = createObjectURL.mock.calls[0]![0];
    expect(blob.type).toBe('text/csv;charset=utf-8');
    expect(blob.size).toBe(new TextEncoder().encode(csv).byteLength);
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:netlist');
  } finally {
    click.mockRestore();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});
