import { scaleFromPins } from '@pcbk/domain/rules';
import type { CommandSpec } from '@pcbk/engine';
import { ScaleFromPinsSchema } from '../contract';
import type { ScaleFromPinsParams } from '../contract';

export const scaleFromPinsCommand: CommandSpec<ScaleFromPinsParams> = {
  id: 'components.scaleFromPins',
  title: 'components.scaleFromPins',
  params: ScaleFromPinsSchema,
  alsoWrites: ['scale'],
  run(doc, { id, ...params }) {
    scaleFromPins(doc, { ...params, componentId: id });
  },
};
