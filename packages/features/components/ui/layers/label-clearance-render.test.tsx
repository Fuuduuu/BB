// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { newBoardDoc } from '@pcbk/domain';
import type { BoardPlacement, Component } from '@pcbk/domain';
import { footprintPinIds } from '@pcbk/domain/footprints';
import { setup } from '../../../__tests__/helpers';
import { ComponentsLayer } from './ComponentsLayer';

afterEach(cleanup);

test('qfp_reference_and_value_are_rendered_above_top_pads', () => {
  const component: Component & { board: BoardPlacement } = {
    id: 'cmp_u1',
    ref: 'U1',
    kind: 'ic',
    marking: '',
    value: 'MCU',
    identified: true,
    dnp: false,
    note: '',
    pins: footprintPinIds('qfp', {})!.map((id) => ({ id, uid: `pin_${id}`, nc: false })),
    board: {
      footprint: 'qfp',
      params: {},
      center: { x: 484, y: 250 },
      side: 'top',
      rotationDeg: 0,
      scaleX: 1,
      scaleY: 1,
      customPads: {},
    },
  };
  const doc = newBoardDoc('Plaat');
  doc.scale.pxPerMm = 10;
  doc.components.push(component);
  const snapshot = setup(doc).engine.snapshot();
  render(
    <svg>
      <ComponentsLayer kind="labels" snapshot={snapshot} zoom={1} preview={null} />
    </svg>,
  );
  expect(Number(screen.getByText('U1').getAttribute('y'))).toBeCloseTo(152.8);
  expect(Number(screen.getByText('MCU').getAttribute('y'))).toBeCloseTo(172);
});
