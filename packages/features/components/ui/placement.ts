import type { Pin } from '@pcbk/domain';
import { footprintPinIds, type FootprintParams } from '@pcbk/domain/footprints';
import { COMPONENT_LIBRARY, type LibraryEntry, type ParamSpec } from '../contract';
import { placementEt } from './i18n/et';

function nameFor(names: Readonly<Record<string, string>>, key: string): string {
  return Object.hasOwn(names, key) ? names[key]! : key;
}

export function footprintName(footprint: string): string {
  return nameFor(placementEt.footprints, footprint);
}

export function libraryName(entryId: string): string {
  return nameFor(placementEt.library.names, entryId);
}

export function parameterLabel(key: string): string {
  const label = placementEt.params[key as keyof typeof placementEt.params];
  return typeof label === 'string' ? label : key;
}

export function searchLibrary(query: string): readonly LibraryEntry[] {
  const words = query.trim().toLocaleLowerCase('et').split(/\s+/);
  return COMPONENT_LIBRARY.filter((entry) => {
    const searchable = `${libraryName(entry.id)} ${entry.kw}`.toLocaleLowerCase('et');
    return words.every((word) => searchable.includes(word));
  });
}

export function positiveDecimal(text: string): number | undefined {
  const number = decimalValue(text);
  return number !== undefined && number > 0 ? number : undefined;
}

export function decimalValue(text: string, allowNegative = false): number | undefined {
  const decimal = text.trim();
  if (!allowNegative && decimal.startsWith('-')) return undefined;
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(decimal)) return undefined;
  const number = Number(decimal.replace(',', '.'));
  return Number.isFinite(number) ? number : undefined;
}

export function numericParameter(
  text: string,
  spec: Extract<ParamSpec, { min: number }>,
): number | undefined {
  const value = decimalValue(text);
  if (value === undefined || value < spec.min || value > spec.max) return undefined;
  const steps = (value - spec.min) / spec.step;
  return Math.abs(steps - Math.round(steps)) < 1e-7 ? value : undefined;
}

function pinCountChoices(spec: ParamSpec): readonly (string | number)[] {
  if ('choices' in spec) return spec.choices;
  return Array.from(
    { length: Math.floor((spec.max - spec.min) / spec.step) + 1 },
    (_, index) => spec.min + index * spec.step,
  );
}

type PlacementOption = { params: FootprintParams; reason?: never } | { reason: string };

export function compatiblePlacement(
  entry: LibraryEntry,
  pins: readonly Pick<Pin, 'id'>[],
): PlacementOption {
  if (entry.footprint === 'area') return { params: entry.params };

  const defaultIds = footprintPinIds(entry.footprint, entry.params);
  const pinIds = new Set(pins.map((pin) => pin.id));
  const countSpec = entry.paramSpec.find(({ key }) => key === 'pins');
  const candidates = [
    entry.params,
    ...(countSpec ? pinCountChoices(countSpec).map((pins) => ({ ...entry.params, pins })) : []),
  ];
  let matchingCount = false;
  for (const params of candidates) {
    const padIds = params === entry.params ? defaultIds : footprintPinIds(entry.footprint, params);
    if (padIds?.length !== pins.length) continue;
    matchingCount = true;
    if (padIds.every((id) => pinIds.has(id))) return { params };
  }
  return {
    reason: matchingCount
      ? placementEt.unplaced.pinNames
      : placementEt.unplaced.pinCount(pins.length, defaultIds?.length ?? 0),
  };
}
