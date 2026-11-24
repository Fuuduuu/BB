import { createElement } from 'react';
import type { LayerSpec } from '@pcbk/ui';
import { PLACE_TOOL_ID } from '../place-store';
import { ComponentsLayer } from './ComponentsLayer';
import {
  componentBodyHits,
  componentLabelHits,
  componentLabelObstacles,
  componentPinHits,
  LABEL_DRAG_OWNER,
} from './hits';
import { SCALE_HANDLES_LAYER } from './ScaleHandlesLayer';
import { SCALE_DRAG_OWNER } from '../../contract';

export const COMPONENTS_LAYERS: LayerSpec[] = [
  {
    id: 'components.bodies',
    z: 30,
    previewOwners: ['select', PLACE_TOOL_ID, SCALE_DRAG_OWNER],
    render: (props) => createElement(ComponentsLayer, { ...props, kind: 'bodies' }),
    hits: componentBodyHits,
  },
  {
    id: 'components.pins',
    z: 50,
    previewOwners: ['select', SCALE_DRAG_OWNER],
    render: (props) => createElement(ComponentsLayer, { ...props, kind: 'pins' }),
    hits: componentPinHits,
  },
  {
    id: 'components.labels',
    z: 60,
    previewOwners: ['select', LABEL_DRAG_OWNER, SCALE_DRAG_OWNER],
    render: (props) => createElement(ComponentsLayer, { ...props, kind: 'labels' }),
    hits: componentLabelHits,
    obstacles: componentLabelObstacles,
  },
  SCALE_HANDLES_LAYER,
];
