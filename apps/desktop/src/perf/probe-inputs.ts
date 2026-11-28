export type ProbeInputCounts = {
  components: number;
  pins: number;
  traces: number;
  schematicSymbols: number;
  measurements: number;
  namedNets: number;
  expected: { measurements: number; namedNets: number };
  anchorPins?: number;
};

export function checkProbeInputs(
  actual: ProbeInputCounts,
): { ok: true } | { ok: false; reason: 'input_count'; mismatched: string[] } {
  const expected = {
    components: 300,
    pins: 3000,
    traces: 1000,
    schematicSymbols: 300,
    measurements: actual.expected.measurements,
    namedNets: actual.expected.namedNets,
    ...(actual.anchorPins === undefined ? {} : { anchorPins: 51 }),
  };
  const names = Object.keys(expected) as Array<keyof typeof expected>;
  const mismatched = names.filter((name) => actual[name] !== expected[name]);
  return mismatched.length ? { ok: false, reason: 'input_count', mismatched } : { ok: true };
}
