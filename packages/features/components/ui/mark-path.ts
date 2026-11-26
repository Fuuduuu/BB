import type { BodyMark } from '@pcbk/domain/footprints';

export function markPath({ lines, filled }: BodyMark): string {
  return lines
    .filter((line) => line.length > 0)
    .map((line) => {
      const commands = line
        .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
        .join(' ');
      return filled ? `${commands} Z` : commands;
    })
    .join(' ');
}
