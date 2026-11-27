// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { newBoardDoc } from '@pcbk/domain';
import type { Component, SymbolPlacement } from '@pcbk/domain';
import { schematicSymbol, symbolToSchematic } from '@pcbk/domain/schematic';
import { UiRegistry, useSessionStore } from '@pcbk/ui';
import { afterEach, expect, test } from 'vitest';
import { idGenerator, setup } from '../../__tests__/helpers';
import { uiFeatures } from '../../ui';

const placement: SymbolPlacement = {
  symbol: 'saved-symbol-is-ignored',
  at: { x: 50.8, y: 25.4 },
  rot: 90,
  mirror: true,
};

function part(
  id: string,
  ref: string,
  kind: Component['kind'],
  names: (string | undefined)[],
  schematic?: SymbolPlacement,
): Component {
  return {
    id,
    ref,
    kind,
    pins: names.map((name, index) => ({
      id: String(index + 1),
      uid: `pin_${id}_${index + 1}`,
      name,
      nc: false,
    })),
    marking: '',
    value: '',
    identified: false,
    dnp: false,
    note: '',
    schematic,
  };
}

afterEach(() => {
  cleanup();
  useSessionStore.getState().reset('');
});

test('symbol_layer_draws_and_hits_from_one_geometry', () => {
  const q1 = part('cmp_q1', 'Q1', 'npn', ['B', 'C', 'E'], placement);
  const doc = newBoardDoc('Sünteetiline skeem');
  doc.components.push(
    q1,
    part('cmp_r1', 'R1', 'resistor', [undefined, undefined], {
      ...placement,
      at: { x: 25.4, y: 25.4 },
    }),
    part(
      'cmp_u1',
      'U1',
      'ic',
      Array.from({ length: 8 }, (_, index) => `P${index + 1}`),
      {
        ...placement,
        at: { x: 25.4, y: 50.8 },
      },
    ),
    part('cmp_via', 'TP1', 'via', [undefined], { ...placement, at: { x: 76.2, y: 25.4 } }),
    part('cmp_r2', 'R2', 'resistor', [undefined, undefined]),
  );

  const { engine } = setup(doc);
  const snapshot = engine.snapshot();
  useSessionStore.getState().setSelection({ items: [{ kind: 'component', id: q1.id }] });
  const registry = new UiRegistry(uiFeatures(idGenerator(), () => {}));
  const layer = registry.schematicLayers().find(({ id }) => id === 'schematic.symbols');
  expect(layer).toBeDefined();

  const { container } = render(<svg>{layer!.render({ snapshot, zoom: 6, preview: null })}</svg>);
  expect(
    Array.from(container.querySelectorAll('[data-symbol]'), (symbol) =>
      symbol.getAttribute('data-symbol'),
    ),
  ).toEqual(['npn', 'resistor', 'box']);
  expect(container.querySelector('[data-component="cmp_via"]')).toBeNull();
  expect(container.querySelector('[data-component="cmp_r2"]')).toBeNull();
  const selected = container.querySelector('[data-component="cmp_q1"]');
  expect(selected?.getAttribute('data-selected')).toBe('true');

  const base = schematicSymbol(q1)?.pins.find(({ contact }) => contact === 'B');
  expect(base).toBeDefined();
  const endpoint = symbolToSchematic(placement, base!.end);
  const drawnPin = selected?.querySelector(`line[data-pin="${base!.pinId}"]`);
  expect(drawnPin).not.toBeNull();
  expect({
    x: Number(drawnPin?.getAttribute('x1')),
    y: Number(drawnPin?.getAttribute('y1')),
  }).toEqual(endpoint);
  const hit = layer!
    .hits?.(snapshot, 6, 'none')
    .find(
      ({ kind, id, componentId }) => kind === 'pin' && id === base!.pinId && componentId === q1.id,
    );
  expect(hit?.shape).toEqual({ type: 'point', at: endpoint, r: 1 });
});
