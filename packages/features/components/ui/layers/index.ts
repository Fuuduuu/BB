import { createElement } from 'react';
import type { LayerSpec } from '@pcbk/ui';
import { ComponentsLayer } from './ComponentsLayer';
import { componentBodyHits, componentLabelHits, componentPinHits } from './hits';

export const COMPONENTS_LAYERS: LayerSpec[] = [
  {
    id: 'components.bodies',
    z: 30,
    render: (props) => createElement(ComponentsLayer, { ...props, kind: 'bodies' }),
    hits: componentBodyHits,
  },
  {
    id: 'components.pins',
    z: 50,
    render: (props) => createElement(ComponentsLayer, { ...props, kind: 'pins' }),
    hits: componentPinHits,
  },
  {
    id: 'components.labels',
    z: 60,
    render: (props) => createElement(ComponentsLayer, { ...props, kind: 'labels' }),
    hits: componentLabelHits,
  },
];
