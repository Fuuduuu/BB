import { body, numberChoice, numberRange, pad } from './helpers';
import { defineFootprint } from './types';

export const pointFootprint = defineFootprint(
  'point',
  'Punkt plaadil',
  { type: 'tp', shape: 'ümar', size: 1.6, D: 3.2 },
  (params) => {
    const D = numberChoice(params.D, [2.2, 3.2, 4.3]),
      size = numberRange(params.size, 0.2, 20);
    if (
      D === undefined ||
      size === undefined ||
      (params.shape !== 'ümar' && params.shape !== 'nelinurk')
    )
      return undefined;
    let contact;
    switch (params.type) {
      case 'tp':
        contact = pad(1, 0, 0, 1.5, 1.5, 'circle');
        break;
      case 'via':
        contact = pad(1, 0, 0, 0.7, 0.7, 'circle', 0.35);
        break;
      case 'pad':
        contact = pad(1, 0, 0, size, size, params.shape === 'nelinurk' ? 'rect' : 'circle');
        break;
      case 'wire':
        contact = pad(1, 0, 0, 2, 2, 'circle', 1);
        break;
      case 'hole':
        contact = pad(1, 0, 0, D * 1.8, D * 1.8, 'circle', D);
        break;
      default:
        return undefined;
    }
    return { pads: [contact], body: body(0, 0) };
  },
);
