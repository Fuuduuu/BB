import { expect, test } from 'vitest';
import { classifyFontEvidence, genericFallbackFamily } from './png-font';

test('font raster diagnostic compares the scene family actual generic fallback', () => {
  expect(genericFallbackFamily('Archivo, Arial, sans-serif')).toBe('sans-serif');
  expect(genericFallbackFamily('"Martian Mono", ui-monospace, Consolas, monospace')).toBe(
    'monospace',
  );
  expect(genericFallbackFamily('Georgia, serif')).toBe('serif');
});

test('same named fallback in document and SVG is never reported as the primary font', () => {
  const result = classifyFontEvidence({
    documentDistance: 0,
    fallbackDistance: 1296209,
    documentFallbackDistance: 1296209,
    candidates: [
      {
        family: 'Martian Mono',
        generic: false,
        documentSentinelDistance: 1278943,
        isolatedSentinelDistance: 1278943,
        documentDistance: 1278943,
        isolatedDistance: 1278943,
      },
      {
        family: 'Cascadia Mono',
        generic: false,
        documentSentinelDistance: 0,
        isolatedSentinelDistance: 0,
        documentDistance: 0,
        isolatedDistance: 0,
      },
      {
        family: 'monospace',
        generic: true,
        documentSentinelDistance: 0,
        isolatedSentinelDistance: 0,
        documentDistance: 1296209,
        isolatedDistance: 1296209,
      },
    ],
  });
  expect(result.observation).toBe('fallback:primary-family-unavailable');
  expect(result.documentChoice.matches).toEqual(['Cascadia Mono']);
  expect(result.isolatedChoice.matches).toEqual(['Cascadia Mono']);
});

test('identical primary and named fallback glyphs remain indistinguishable', () => {
  const result = classifyFontEvidence({
    documentDistance: 0,
    fallbackDistance: 2000,
    documentFallbackDistance: 2000,
    candidates: ['Primary', 'Fallback'].map((family) => ({
      family,
      generic: false,
      documentSentinelDistance: 0,
      isolatedSentinelDistance: 0,
      documentDistance: 0,
      isolatedDistance: 0,
    })),
  });
  expect(result.observation).toBe('unknown:font-families-indistinguishable');
});
