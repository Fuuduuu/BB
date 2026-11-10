import type { Pin } from '@pcbk/domain';
import { footprintPinIds, type FootprintParams } from '@pcbk/domain/footprints';
import { COMPONENT_LIBRARY, type LibraryEntry } from '../contract';
import { placementEt } from './i18n/et';

export const chipSizes = ['0402', '0603', '0805', '1206'] as const;
export const headerPitches = [1.27, 2, 2.54] as const;
export const footprintPinCounts: Readonly<Partial<Record<string, readonly number[]>>> = {
  sot23: [3, 5, 6],
  soic: [8, 14, 16, 20, 24, 28],
  header1: Array.from({ length: 40 }, (_, index) => index + 1),
};

function nameFor(names: Readonly<Record<string, string>>, key: string): string {
  return Object.hasOwn(names, key) ? names[key]! : key;
}

export function footprintName(footprint: string): string {
  return nameFor(placementEt.footprints, footprint);
}

export function libraryName(entryId: string): string {
  return nameFor(placementEt.library.names, entryId);
}

export function searchLibrary(query: string): readonly LibraryEntry[] {
  const words = query.trim().toLocaleLowerCase('et').split(/\s+/);
  return COMPONENT_LIBRARY.filter((entry) => {
    const searchable = `${libraryName(entry.id)} ${entry.kw}`.toLocaleLowerCase('et');
    return words.every((word) => searchable.includes(word));
  });
}

export function positiveDecimal(text: string): number | undefined {
  const decimal = text.trim();
  if (!/^\+?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(decimal)) return undefined;
  const number = Number(decimal.replace(',', '.'));
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

type PlacementOption = { params: FootprintParams; reason?: never } | { reason: string };

export function compatiblePlacement(
  entry: LibraryEntry,
  pins: readonly Pick<Pin, 'id'>[],
): PlacementOption {
  if (entry.footprint === 'area') return { params: entry.params };

  const defaultIds = footprintPinIds(entry.footprint, entry.params);
  const counts = footprintPinCounts[entry.footprint];
  // For these families, the pin count is the only parameter that changes the pad IDs.
  const params =
    defaultIds?.length !== pins.length && counts?.includes(pins.length)
      ? { ...entry.params, pins: pins.length }
      : entry.params;
  const padIds = params === entry.params ? defaultIds : footprintPinIds(entry.footprint, params);
  if (padIds?.length !== pins.length) {
    return { reason: placementEt.unplaced.pinCount(pins.length, defaultIds?.length ?? 0) };
  }
  const pinIds = new Set(pins.map((pin) => pin.id));
  if (!padIds.every((id) => pinIds.has(id))) {
    return { reason: placementEt.unplaced.pinNames };
  }
  return { params };
}
