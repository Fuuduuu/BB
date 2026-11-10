import { expect, test } from 'vitest';
import { formatReading, parseReading } from '@pcbk/domain/measure';

test('parse_reading_accepts_comma_and_dot', () => {
  for (const text of ['4,98V', '4.98v', '  4,98  V ', '4.98']) {
    expect(parseReading(text, 'voltage')).toEqual({ value: 4.98 });
  }
});

test('parse_reading_si_suffixes', () => {
  const readings = [
    ['5m', 0.005],
    ['5 mV', 0.005],
    ['4.7k', 4700],
    ['4k7', 4700],
    ['3m3 V', 0.0033],
    ['1,2M', 1_200_000],
    ['2M2v', 2_200_000],
  ] as const;

  for (const [text, value] of readings) {
    expect(parseReading(text, 'voltage')).toEqual({ value });
  }
});

test('parse_reading_accepts_sign', () => {
  expect(parseReading('+5 V', 'voltage')).toEqual({ value: 5 });
  expect(parseReading('+3.3', 'voltage')).toEqual({ value: 3.3 });
  expect(parseReading('-5,0', 'voltage')).toEqual({ value: -5 });
  expect(parseReading('-4,98V', 'voltage')).toEqual({ value: -4.98 });
  expect(parseReading('-3m3 V', 'voltage')).toEqual({ value: -0.0033 });
});

test('invalid_voltage_returns_null', () => {
  const invalidReadings = [
    '',
    ' ',
    '+',
    '-',
    'm',
    'k',
    'V',
    'OL',
    'abc',
    '1e3',
    '1e999',
    'Infinity',
    'NaN',
    '1 A',
    '5Ω',
    '10 kΩ',
    '60 Hz',
    '1,2,3',
    '1.234,5',
    '1.2.3',
    '3m3.4',
    '5mm',
    '5K',
    '5vv',
    '3%V',
    '2+3',
    '9'.repeat(310),
  ];

  for (const reading of invalidReadings) {
    expect(parseReading(reading, 'voltage'), reading).toBeNull();
  }
  expect(parseReading('5', 'resistance' as 'voltage')).toBeNull();
});

test('format_reading_uses_decimal_comma_and_millivolts', () => {
  const readings = [
    [4.98, '4,98 V'],
    [4.9876, '4,988 V'],
    [12, '12 V'],
    [-5, '-5 V'],
    [1, '1 V'],
    [0.005, '5 mV'],
    [0.0033, '3,3 mV'],
    [0.5, '500 mV'],
    [0.003336, '3,34 mV'],
    [-0.0047, '-4,7 mV'],
    [0, '0 V'],
  ] as const;

  for (const [value, formatted] of readings) {
    expect(formatReading({ value }, 'voltage')).toBe(formatted);
  }
});

test('format_reading_switches_unit_after_rounding', () => {
  expect(formatReading({ value: 0.999999 }, 'voltage')).toBe('1 V');
  expect(formatReading({ value: -0.999999 }, 'voltage')).toBe('-1 V');
  expect(formatReading({ value: 0.999994 }, 'voltage')).toBe('999,99 mV');
});
