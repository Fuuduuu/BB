import { useState } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import { Button } from '@pcbk/ui';
import type { KeySpec, Selection, ToolApi } from '@pcbk/ui';
import { selectComponent } from '../contract';
import { commandError } from './errors';
import { placementEt } from './i18n/et';
import { footprintName } from './placement';

const number = new Intl.NumberFormat('et', { useGrouping: false, maximumSignificantDigits: 21 });

const parameterNames: Record<string, string> = {
  size: placementEt.params.size,
  pins: placementEt.params.pins,
  pitch: placementEt.params.pitch,
  w: placementEt.params.width,
  h: placementEt.params.height,
  body: placementEt.params.body,
};

function parameterText(key: string, value: string | number): string {
  const name = Object.hasOwn(parameterNames, key) ? parameterNames[key] : key;
  const amount = typeof value === 'number' ? number.format(value) : value;
  return `${name} ${amount}`;
}

export function PlacementSection({ id }: { id: string }) {
  const engine = useEngine();
  const board = useSnapshot((snapshot) => selectComponent(snapshot, id)?.board);
  const [error, setError] = useState<string>();
  if (!board) return null;

  const text = placementEt.section;
  const params = Object.entries(board.params).map(([key, value]) => parameterText(key, value));
  const report = (result: ReturnType<ToolApi['execute']>) =>
    setError(result.ok ? undefined : commandError(result.error));
  const rotate = (deltaDeg: number) =>
    report(engine.execute('components.rotate', { id, deltaDeg }));

  return (
    <div className="pcbk-component-details">
      <h2>{text.title}</h2>
      <dl>
        <dt>{text.footprint}</dt>
        <dd>{footprintName(board.footprint)}</dd>
        {params.length > 0 && (
          <>
            <dt>{text.parameters}</dt>
            <dd>{params.join(' · ')}</dd>
          </>
        )}
        <dt>{text.angle}</dt>
        <dd>{number.format(board.rotationDeg)}°</dd>
        <dt>{text.side}</dt>
        <dd>{board.side === 'top' ? text.top : text.bottom}</dd>
      </dl>
      <div className="pcbk-component-form">
        <Button onClick={() => rotate(90)}>{text.rotateClockwise}</Button>
        <Button onClick={() => rotate(-90)}>{text.rotateCounterclockwise}</Button>
        <Button onClick={() => report(engine.execute('components.flipSide', { id }))}>
          {text.flip}
        </Button>
        <Button onClick={() => report(engine.execute('components.removeFromBoard', { id }))}>
          {text.remove}
        </Button>
      </div>
      {error && (
        <p className="bb-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function forPlaced(api: ToolApi, selection: Selection, run: (id: string) => void): boolean {
  const ids = new Set(
    selection.items.filter((item) => item.kind === 'component').map(({ id }) => id),
  );
  if (ids.size === 0) return false;
  let handled = false;
  for (const { id, board } of api.snapshot().doc.components) {
    if (!board || !ids.has(id)) continue;
    run(id);
    handled = true;
  }
  return handled;
}

export const placementKeys: KeySpec[] = [
  {
    id: 'components.rotateClockwise',
    key: 'R',
    run: (api, selection) =>
      forPlaced(api, selection, (id) => api.execute('components.rotate', { id, deltaDeg: 90 })),
  },
  {
    id: 'components.rotateCounterclockwise',
    key: 'R',
    shift: true,
    run: (api, selection) =>
      forPlaced(api, selection, (id) => api.execute('components.rotate', { id, deltaDeg: -90 })),
  },
  {
    id: 'components.flipSide',
    key: 'F',
    run: (api, selection) =>
      forPlaced(api, selection, (id) => api.execute('components.flipSide', { id })),
  },
];
