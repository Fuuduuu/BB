export type ReadingMode = 'voltage';

const siExponents: Readonly<Record<string, number>> = { m: -3, k: 3, M: 6 };
const voltageFormatter = new Intl.NumberFormat('en-US', {
  useGrouping: false,
  maximumFractionDigits: 3,
});
const millivoltFormatter = new Intl.NumberFormat('en-US', {
  useGrouping: false,
  maximumFractionDigits: 2,
});

export function parseReading(text: string, mode: ReadingMode): { value: number } | null {
  if (mode !== 'voltage') return null;

  const normalized = text
    .replace(/\s/g, '')
    .replace(/[Vv]$/, '')
    .replace(/^([+-]?\d+)([mkM])(\d+)$/, '$1.$3$2')
    .replace(',', '.');
  const [, decimal, multiplier] = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))([mkM])?$/.exec(normalized) ?? [];
  if (decimal === undefined) return null;

  const exponent = multiplier === undefined ? 0 : siExponents[multiplier];
  const value = Number(`${decimal}e${exponent}`);
  return Number.isFinite(value) ? { value } : null;
}

export function formatReading(reading: { value: number }, mode: ReadingMode): string {
  switch (mode) {
    case 'voltage': {
      const { value } = reading;
      if (value === 0) return '0 V';
      if (Math.abs(value) < 1) {
        const millivolts = millivoltFormatter.format(value * 1000);
        if (Math.abs(Number(millivolts)) < 1000) {
          return `${millivolts.replace('.', ',')} mV`;
        }
      }
      return `${voltageFormatter.format(value).replace('.', ',')} V`;
    }
  }
}
