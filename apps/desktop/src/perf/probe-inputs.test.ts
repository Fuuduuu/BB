import { expect, test } from 'vitest';

import { checkProbeInputs } from './probe-inputs';

test('probe_checks_inputs_before_timing', () => {
  const expected = {
    components: 300,
    pins: 3000,
    traces: 1000,
    schematicSymbols: 300,
    measurements: 2000,
    namedNets: 12,
    anchorPins: 51,
  };
  const actual = { ...expected, expected: { measurements: 2000, namedNets: 12 } };
  expect(checkProbeInputs(actual)).toEqual({ ok: true });
  for (const name of Object.keys(expected) as Array<keyof typeof expected>) {
    expect(checkProbeInputs({ ...actual, [name]: expected[name] - 1 }), name).toEqual({
      ok: false,
      reason: 'input_count',
      mismatched: [name],
    });
  }
});
