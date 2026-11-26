import { buildRegistry, RegistryError } from '@pcbk/engine';
import { expect, test } from 'vitest';
import { assertModulePairs, UI_ONLY_MODULES } from './composition';
import { connectionsEngine } from './connections/engine';
import { engineFeatures, RESERVED_FIELDS } from './engine';
import { uiFeatures } from './ui';

test('product module pairs match with only guide and export as UI-only exceptions', () => {
  const engineIds = engineFeatures.map(({ id }) => id);
  const uiIds = uiFeatures({ newId: () => 'unused' }, () => {}).map(({ id }) => id);
  expect(UI_ONLY_MODULES).toEqual(['guide', 'export']);
  expect(() =>
    assertModulePairs(engineIds, [...uiIds, ...UI_ONLY_MODULES], UI_ONLY_MODULES),
  ).not.toThrow();
  expect(() => assertModulePairs(engineIds, [...uiIds, 'home-feedback'], UI_ONLY_MODULES)).toThrow(
    /Missing engine module.*home-feedback/,
  );
  expect(() => assertModulePairs([...engineIds, 'guide'], uiIds, UI_ONLY_MODULES)).toThrow(
    /Missing UI module.*guide/,
  );
});

test('module mismatch names both missing counterparts', () => {
  expect(() => assertModulePairs(['components'], ['components-typo'], UI_ONLY_MODULES)).toThrow(
    'Missing engine module for UI module: components-typo; Missing UI module for engine module: components',
  );
  expect(() => assertModulePairs(['components'], [], UI_ONLY_MODULES)).toThrow(
    /Missing UI module.*components/,
  );
  expect(() => assertModulePairs([], ['photo'], UI_ONLY_MODULES)).toThrow(
    /Missing engine module.*photo/,
  );
});

test('measurements_requires_connections_module', () => {
  const modules = engineFeatures.filter((module) => module !== connectionsEngine);
  const reserved = [...RESERVED_FIELDS, ...(connectionsEngine.owns ?? [])];
  const registerWithoutConnections = () => buildRegistry(modules, reserved);
  expect(registerWithoutConnections).toThrow(RegistryError);
  expect(registerWithoutConnections).toThrow('Missing module dependency: connections');
  expect(() => buildRegistry(engineFeatures, RESERVED_FIELDS)).not.toThrow();
});
