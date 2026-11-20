import type { Plugin } from 'vite';

const instrumentation = `
function measureProbePhase<T>(phase: 'validateDocument' | 'derived' | 'nets', run: () => T): T {
  const record = globalThis.__PCBK_PERF_RECORD_PHASE__;
  if (!record) return run();
  const started = performance.now();
  try {
    return run();
  } finally {
    record(phase, performance.now() - started);
  }
}
`;

function inject(code: string, original: string, timed: string) {
  if (code.split(original).length !== 2)
    throw new Error(`Probe timing marker changed: ${original}`);
  return code.replace(original, timed);
}

// Time the real command path in the WebView2 probe without changing engine sources or releases.
export function probeTimingPlugin(): Plugin {
  return {
    name: 'pcbk-probe-timing',
    apply: 'serve',
    enforce: 'pre',
    transform(code, id) {
      const path = id.replaceAll('\\', '/');
      if (path.endsWith('/packages/engine/src/engine.ts')) {
        const timed = inject(
          code,
          '        validateDocument(next);',
          "        measureProbePhase('validateDocument', () => validateDocument(next));",
        );
        return timed + instrumentation;
      }
      if (path.endsWith('/packages/engine/src/derivation.ts')) {
        const timedNets = inject(
          code,
          'spec.schema.parse(spec.run(doc, sealTree(derived)))',
          `spec.key === 'nets'
            ? measureProbePhase('nets', () => spec.schema.parse(spec.run(doc, sealTree(derived))))
            : spec.schema.parse(spec.run(doc, sealTree(derived)))`,
        );
        const start = inject(
          timedNets,
          '    let derived = { ...empty.derived };',
          "    const derived = measureProbePhase('derived', () => {\n      let derived = { ...empty.derived };",
        );
        const timed = inject(
          start,
          '    return sealTree({ sessionId, rev: doc.rev, doc, derived, history });',
          '      return derived;\n    });\n    return sealTree({ sessionId, rev: doc.rev, doc, derived, history });',
        );
        return timed + instrumentation;
      }
    },
  };
}
