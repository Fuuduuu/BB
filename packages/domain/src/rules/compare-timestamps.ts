function parseMilliseconds(timestamp: string, decimal: number): number {
  const end = decimal + 4;
  // Parse at most three digits so long fractions cannot affect the millisecond.
  return Date.parse(
    decimal >= 0 && end < timestamp.length - 1 ? timestamp.slice(0, end) + 'Z' : timestamp,
  );
}

function subMillisecondDigits(timestamp: string, decimal: number): string {
  if (decimal < 0) return '';

  const start = decimal + 4;
  let end = timestamp.length - 1; // Board timestamps end with Z.
  while (end > start && timestamp[end - 1] === '0') end--;
  return timestamp.slice(start, end);
}

export function compareTimestamps(a: string, b: string): number {
  if (a === b) return 0;

  const decimalA = a.indexOf('.');
  const decimalB = b.indexOf('.');
  const milliseconds = parseMilliseconds(a, decimalA) - parseMilliseconds(b, decimalB);
  if (milliseconds !== 0) return milliseconds;

  const remainderA = subMillisecondDigits(a, decimalA);
  const remainderB = subMillisecondDigits(b, decimalB);
  if (remainderA === remainderB) return 0;
  return remainderA < remainderB ? -1 : 1;
}
