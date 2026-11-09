import { expect, test } from 'vitest';
import { BoardPlacementSchema, SymbolPlacementSchema } from './component';

const board = {
  footprint: 'custom',
  params: {},
  center: { x: 0, y: 0 },
  rotationDeg: 0,
  side: 'top',
  scaleX: 1,
  scaleY: 1,
  customPads: {},
};
const symbol = { symbol: 'box', at: { x: 0, y: 0 }, rot: 0, mirror: false };
const cases = [
  [
    'params',
    BoardPlacementSchema,
    { ...board, params: JSON.parse('{"__proto__":"keep","pins":8}') },
  ],
  ['padMap', BoardPlacementSchema, { ...board, padMap: JSON.parse('{"__proto__":"1","A":"2"}') }],
  [
    'customPads',
    BoardPlacementSchema,
    {
      ...board,
      customPads: JSON.parse(
        '{"__proto__":{"local":{"x":0,"y":0},"sizeMm":1,"shape":"circle","through":false}}',
      ),
    },
  ],
  ['pinMap', SymbolPlacementSchema, { ...symbol, pinMap: JSON.parse('{"__proto__":"1","B":"2"}') }],
] as const;

test.each(cases)(
  '%s rejects reserved JSON keys instead of silently losing them',
  (_name, schema, input) => {
    expect(schema.safeParse(input).success).toBe(false);
  },
);

test('ordinary dynamic keys including constructor are preserved', () => {
  const params = JSON.parse('{"constructor":"keep","prototype":8,"toString":"text"}') as Record<
    string,
    string | number
  >;
  const padMap = JSON.parse('{"constructor":"1","prototype":"2"}') as Record<string, string>;
  const parsedBoard = BoardPlacementSchema.parse({ ...board, params, padMap });
  const parsedSymbol = SymbolPlacementSchema.parse({ ...symbol, pinMap: padMap });
  expect(parsedBoard.params).toEqual(params);
  expect(parsedBoard.padMap).toEqual(padMap);
  expect(parsedSymbol.pinMap).toEqual(padMap);
});
