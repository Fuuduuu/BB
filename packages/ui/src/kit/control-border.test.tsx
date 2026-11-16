// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Button, Field } from './index';

const tokens = readFileSync('packages/ui/src/kit/tokens.css', 'utf8');
const kit = readFileSync('packages/ui/src/kit/kit.css', 'utf8');
const styles: HTMLStyleElement[] = [];

afterEach(() => {
  cleanup();
  styles.splice(0).forEach((style) => style.remove());
});

function stylesheet(css: string) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  styles.push(style);
  return style.sheet!;
}

function themeTokens() {
  const rules = stylesheet(tokens).cssRules;
  return [
    (rules[0] as CSSStyleRule).style,
    ((rules[1] as CSSMediaRule).cssRules[0] as CSSStyleRule).style,
    (rules[2] as CSSStyleRule).style,
  ];
}

function luminance(hex: string) {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

test('input_border_contrast_at_least_3_to_1_in_both_themes', () => {
  for (const theme of themeTokens()) {
    const border = luminance(theme.getPropertyValue('--control-border').trim());
    const panel = luminance(theme.getPropertyValue('--panel').trim());
    const contrast = (Math.max(border, panel) + 0.05) / (Math.min(border, panel) + 0.05);
    expect(contrast).toBeGreaterThanOrEqual(3);
  }
});

test.each([
  [0, 'rgb(125, 138, 130)'],
  [1, 'rgb(99, 120, 109)'],
  [2, 'rgb(99, 120, 109)'],
] as const)('controls use the contrasting border in theme branch %s', (branch, border) => {
  const theme = themeTokens()[branch]!;
  // jsdom does not resolve custom properties; substitute the real theme values only.
  stylesheet(kit.replace(/var\((--[\w-]+)\)/g, (_, name: string) => theme.getPropertyValue(name)));
  render(
    <>
      <Field label="Tähis" />
      <select className="bb-input" aria-label="Toide">
        <option>Teadmata</option>
      </select>
      <textarea className="bb-input" aria-label="Märkus" />
      <Button>Muuda</Button>
      <Button variant="primary">Salvesta</Button>
      <Field label="Vigane" error="Vigane väärtus" />
      <div className="bb-dialog" role="dialog" aria-label="Näidis" />
    </>,
  );
  for (const control of [
    screen.getByRole('textbox', { name: 'Tähis' }),
    screen.getByRole('combobox', { name: 'Toide' }),
    screen.getByRole('textbox', { name: 'Märkus' }),
    screen.getByRole('button', { name: 'Muuda' }),
  ]) {
    expect(getComputedStyle(control).borderTopColor).toBe(border);
  }
  const primary = screen.getByRole('button', { name: 'Salvesta' });
  const reference = document.createElement('span');
  reference.style.color = theme.getPropertyValue('--line-2');
  expect(getComputedStyle(screen.getByRole('dialog', { name: 'Näidis' })).borderTopColor).toBe(
    reference.style.color,
  );
  reference.style.color = theme.getPropertyValue('--accent');
  expect(getComputedStyle(primary).borderTopColor).toBe(reference.style.color);
  expect(getComputedStyle(primary).backgroundColor).toBe(reference.style.color);
  reference.style.color = theme.getPropertyValue('--danger');
  expect(getComputedStyle(screen.getByRole('textbox', { name: 'Vigane' })).borderTopColor).toBe(
    reference.style.color,
  );
  const input = screen.getByRole('textbox', { name: 'Tähis' });
  input.focus();
  reference.style.color = theme.getPropertyValue('--accent');
  expect(input.matches(':focus-visible')).toBe(true);
  expect(getComputedStyle(input).borderTopColor).toBe(reference.style.color);
});
