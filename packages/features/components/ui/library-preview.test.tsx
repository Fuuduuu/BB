// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { useSessionStore } from '@pcbk/ui';
import { Library } from './Library';
import { usePlaceStore } from './place-store';

afterEach(() => {
  cleanup();
  usePlaceStore.getState().reset();
  useSessionStore.getState().reset('');
});

function open(name: string) {
  render(<Library />);
  fireEvent.click(screen.getByRole('button', { name }));
}

test('library_preview_updates_with_pin_count', () => {
  open('SOIC');
  expect(screen.getByRole('img').querySelectorAll('[data-pad]')).toHaveLength(8);
  fireEvent.change(screen.getByRole('combobox', { name: 'Jalgu' }), {
    target: { value: '16' },
  });
  expect(screen.getByRole('img').querySelectorAll('[data-pad]')).toHaveLength(16);
  fireEvent.click(screen.getByRole('button', { name: 'Paiguta' }));
  expect(usePlaceStore.getState().request).toEqual({
    mode: 'new',
    entryId: 'soic',
    params: { pins: 16, body: 3.9 },
  });
});

test('library_preview_shows_pin1_marker', () => {
  open('SOIC');
  const marker = screen.getByRole('img').querySelector('[data-pin1]');
  expect(marker?.tagName).toBe('circle');
  expect(marker?.getAttribute('cx')).toBe('-1.35');
  expect(marker?.getAttribute('cy')).toBe('-1.84');
});

test('library_preview_hidden_for_invalid_params', () => {
  open('QFP');
  expect(screen.getByRole('img')).toBeTruthy();
  const body = screen.getByLabelText('Kere (mm, 0 = auto)');
  for (const value of ['', '-', '0,15', '40.1']) {
    fireEvent.change(body, { target: { value } });
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Kontrolli parameetreid')).toBeTruthy();
  }
  fireEvent.change(body, { target: { value: '0' } });
  expect(screen.getByRole('img')).toBeTruthy();
  expect(screen.queryByText('Kontrolli parameetreid')).toBeNull();
});

test('library_preview_label_names_package_and_pins', () => {
  open('SOIC');
  expect(screen.getByRole('img', { name: 'Pealtvaade: SOIC, 8 jalga' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Testpunkt' }));
  expect(screen.getByRole('img', { name: 'Pealtvaade: Testpunkt, 1 jalg' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Tundmatu komponent' }));
  expect(screen.getByRole('img', { name: 'Pealtvaade: Tundmatu komponent' })).toBeTruthy();
});

test('library_preview_frames_body_and_pads_with_padding_without_distortion', () => {
  open('SOIC');
  const svg = screen.getByRole('img');
  const viewBox = svg.getAttribute('viewBox')!.split(' ').map(Number);
  // Body: x ±1.95, y ±2.44; pads extend x to ±3.55.
  expect(viewBox[0]).toBeCloseTo(-4.26);
  expect(viewBox[1]).toBeCloseTo(-2.94);
  expect(viewBox[2]).toBeCloseTo(8.52);
  expect(viewBox[3]).toBeCloseTo(5.88);
  expect(svg.getAttribute('width')).toBe('120');
  expect(svg.getAttribute('height')).toBe('72');
  expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
  const body = svg.querySelector('rect:not([data-pad])');
  expect(body?.getAttribute('fill')).toBe('var(--body-fill)');
  expect(body?.getAttribute('stroke')).toBe('var(--body)');
  for (const shape of svg.querySelectorAll('rect, circle')) {
    expect(shape.getAttribute('vector-effect')).toBe('non-scaling-stroke');
  }
  expect(svg.querySelector('[data-pad="1"]')?.getAttribute('stroke')).toBe('var(--ink-3)');
});

test('library_preview_keeps_oval_pads_and_their_full_bounds', () => {
  open('USB-C');
  const svg = screen.getByRole('img');
  const oval = svg.querySelector('[data-pad="S1"]');
  expect(oval?.tagName).toBe('rect');
  expect(oval?.getAttribute('width')).toBe('0.9');
  expect(oval?.getAttribute('height')).toBe('2');
  expect(oval?.getAttribute('rx')).toBe('0.45');
  const viewBox = svg.getAttribute('viewBox')!.split(' ').map(Number);
  // Side pads reach x ±4.77; contacts reach y -4.425; body reaches y 3.65.
  expect(viewBox[0]).toBeCloseTo(-5.724);
  expect(viewBox[1]).toBeCloseTo(-5.2325);
  expect(viewBox[2]).toBeCloseTo(11.448);
  expect(viewBox[3]).toBeCloseTo(9.69);
});

test('library_preview_point_has_one_real_pad_and_no_body', () => {
  open('Testpunkt');
  const svg = screen.getByRole('img');
  expect(svg.querySelectorAll('rect, circle')).toHaveLength(1);
  const pad = svg.querySelector('[data-pad="1"]');
  expect(pad?.tagName).toBe('circle');
  expect(pad?.getAttribute('r')).toBe('0.75');
  expect(svg.getAttribute('viewBox')).toBe('-1.25 -1.25 2.5 2.5');
  expect(svg.querySelector('[data-pin1]')).toBeNull();
});

test('library_preview_draws_footprint_shape', () => {
  open('Elektrolüüt THT');
  const radialPreview = screen.getByRole('img');
  expect(radialPreview.querySelector('polygon[data-body-shape="circle"]')).not.toBeNull();
  expect(radialPreview.querySelector('rect:not([data-pad])')).toBeNull();
  const radialRow = screen.getByRole('button', { name: 'Elektrolüüt THT' });
  expect(
    radialRow.querySelector('[data-silhouette] polygon[data-body-shape="circle"]'),
  ).not.toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Keraamiline kondensaator THT' }));
  expect(screen.getByRole('img').querySelector('polygon[data-body-shape="oval"]')).not.toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'LED THT' }));
  expect(screen.getByRole('img').querySelector('polygon[data-body-shape="d"]')).not.toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Takisti SMD' }));
  expect(screen.getByRole('img').querySelector('rect:not([data-pad])')).not.toBeNull();

  expect(screen.getByRole('button', { name: 'Keraamiline kondensaator SMD' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Kondensaator THT' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Kondensaator SMD' })).toBeNull();
});
