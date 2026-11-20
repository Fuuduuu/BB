// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { mountMeasurements } from '../../measurements/__tests__/workspace';

const pin = (p: string) => ({ pin: { c: 'cmp_u1', p } });
const joint = (junction: string) => ({ junction });
const drawing = {
  kind: 'trace',
  layer: 'top',
  waypoints: [],
  widthMm: 0.6,
} as const;

test('role_color_reaches_traces_and_pins_in_both_themes', () => {
  const { svg, clickPin } = mountMeasurements({
    seed(doc) {
      doc.junctions.push(
        { id: 'jun_power', board: { at: { x: 200, y: 150 }, layer: 'top' } },
        { id: 'jun_ground', board: { at: { x: 250, y: 150 }, layer: 'top' } },
        { id: 'jun_plain', board: { at: { x: 300, y: 150 }, layer: 'top' } },
      );
      doc.connections.push(
        {
          id: 'con_power_trace',
          a: pin('1'),
          b: pin('2'),
          basis: 'visual',
          board: { ...drawing, waypoints: [] },
        },
        { id: 'con_power_air', a: pin('2'), b: joint('jun_power'), basis: 'assumed' },
        {
          id: 'con_ground',
          a: joint('jun_ground'),
          b: pin('3'),
          basis: 'visual',
          board: { ...drawing, waypoints: [] },
        },
        {
          id: 'con_plain',
          a: pin('4'),
          b: joint('jun_plain'),
          basis: 'visual',
          board: { ...drawing, waypoints: [] },
        },
      );
      doc.netLabels.push(
        { id: 'lbl_power', anchor: pin('1'), roleId: 'rol_5v', source: 'user' },
        { id: 'lbl_ground', anchor: pin('3'), roleId: 'rol_gnd', source: 'user' },
      );
    },
  });

  const root = document.documentElement;
  const previousTheme = root.dataset.theme;
  const style = document.createElement('style');
  style.textContent = readFileSync('packages/ui/src/kit/tokens.css', 'utf8');
  document.head.append(style);
  try {
    for (const [theme, ground] of [
      ['light', '#1f2523'],
      ['dark', '#9aa5a0'],
    ] as const) {
      root.dataset.theme = theme;
      const traces = svg.querySelectorAll('[data-layer="connections.traces"] polyline');
      expect(Array.from(traces, (trace) => trace.getAttribute('stroke'))).toEqual([
        '#d9342b',
        'var(--role-gnd)',
        'var(--top)',
      ]);
      const airLine = svg.querySelector('[data-layer="connections.airLines"] line');
      expect(airLine?.getAttribute('stroke')).toBe('#d9342b');
      const rings = svg.querySelector('[data-layer="nets.pinRoles"]');
      expect(rings?.querySelector('[data-pin-role="cmp_u1:1"]')?.getAttribute('stroke')).toBe(
        '#d9342b',
      );
      expect(rings?.querySelector('[data-pin-role="cmp_u1:3"]')?.getAttribute('stroke')).toBe(
        'var(--role-gnd)',
      );
      expect(rings?.querySelector('[data-pin-role="cmp_u1:4"]')).toBeNull();
      expect(getComputedStyle(root).getPropertyValue('--role-gnd').trim()).toBe(ground);
    }
    clickPin('3');
    const selection = svg.querySelector(
      '[data-layer="components.pins"] [data-pin="3"] circle[stroke="var(--sel)"]',
    );
    const role = svg.querySelector('[data-pin-role="cmp_u1:3"]');
    expect(selection).not.toBeNull();
    expect(Number(role?.getAttribute('r'))).toBeGreaterThan(Number(selection?.getAttribute('r')));
  } finally {
    style.remove();
    if (previousTheme === undefined) delete root.dataset.theme;
    else root.dataset.theme = previousTheme;
  }
});
