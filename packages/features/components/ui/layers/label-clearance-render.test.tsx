// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { BoardPlacement, Component } from '@pcbk/domain';
import { ComponentShape } from './ComponentShape';

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
    pins: [],
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
  render(
    <svg>
      <ComponentShape
        component={component}
        kind="labels"
        pxPerMm={10}
        zoom={1}
        selected={false}
        selectedPinId={null}
        dx={0}
        dy={0}
        labelDx={0}
        labelDy={0}
      />
    </svg>,
  );
  expect(Number(screen.getByText('U1').getAttribute('y'))).toBeCloseTo(152.8);
  expect(Number(screen.getByText('MCU').getAttribute('y'))).toBeCloseTo(172);
});
