// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import type { NetLabel } from '@pcbk/domain';
import { useSessionStore } from '@pcbk/ui';
import { expect, test } from 'vitest';
import { mountMeasurements } from '../../measurements/__tests__/workspace';

const role = { id: 'rol_test', label: 'Katsesignaal', kind: 'signal', color: '#176b5c' } as const;

function label(id: string, pin: string, name?: string): NetLabel {
  return {
    id,
    anchor: { pin: { c: 'cmp_u1', p: pin } },
    ...(name === undefined ? {} : { name }),
    roleId: role.id,
    source: 'user',
  };
}

test('label_removal_shows_notice_with_undo_hint', () => {
  const cases = [
    { labels: [label('lbl_vbus', '1', 'VBUS')], text: 'Võrgusilt VBUS eemaldati' },
    { labels: [label('lbl_signal', '1')], text: 'Võrgusilt eemaldati' },
    {
      labels: [label('lbl_vbus', '1', 'VBUS'), label('lbl_signal', '2')],
      text: '2 võrgusilti eemaldati',
    },
  ];
  for (const { labels, text } of cases) {
    const { engine, svg, unmount } = mountMeasurements({
      seed(doc) {
        doc.roles.push(role);
        doc.netLabels.push(...labels);
      },
    });
    act(() => {
      useSessionStore.getState().setSelection({ items: [{ kind: 'component', id: 'cmp_u1' }] });
    });
    fireEvent.keyDown(svg, { key: 'Delete' });
    expect(engine.snapshot().doc.netLabels).toEqual([]);

    const message = `${text} · Ctrl+Z toob tagasi`;
    const bottomBar = screen.getByLabelText('Plaadi olek');
    const toast = within(bottomBar).getByText(message).closest('[role="status"]')!;
    fireEvent.click(within(toast as HTMLElement).getByRole('button', { name: 'Peida teade' }));
    expect(within(bottomBar).queryByText(message)).toBeNull();

    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
    expect(engine.snapshot().doc.netLabels).toEqual(labels);
    expect(within(bottomBar).queryByText(/Ctrl\+Z toob tagasi/u)).toBeNull();

    expect(engine.execute('roles.remove', { id: 'rol_gnd' })).toMatchObject({
      ok: false,
      error: { code: 'validation', issues: [{ message: 'default_role' }] },
    });
    expect(engine.execute('roles.remove', { id: role.id })).toMatchObject({
      ok: false,
      error: { code: 'validation', issues: [{ message: 'role_in_use' }] },
    });

    fireEvent.keyDown(svg, { key: 'y', ctrlKey: true });
    expect(engine.snapshot().doc.netLabels).toEqual([]);
    expect(within(bottomBar).queryByText(/Ctrl\+Z toob tagasi/u)).toBeNull();
    unmount();
  }
});
