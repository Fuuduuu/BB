import { expect, test } from 'vitest';
import { et } from '../../../../ui/src/shell/i18n/et';
import * as componentTexts from './et';

test('component_texts_live_in_module', () => {
  expect(et).not.toHaveProperty('component');
  expect(componentTexts).toHaveProperty('componentEt');
  expect(componentTexts).toMatchObject({
    componentEt: {
      title: 'Komponendid',
      add: 'Lisa komponent',
      failed: 'Muudatust ei saanud teha. Proovi uuesti.',
      kinds: { resistor: 'Takisti', other: 'Muu' },
    },
    placementEt: { tool: 'Paiguta' },
  });
});
