import { useState } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import { Button, Field } from '@pcbk/ui';
import type { IdGen } from '@pcbk/contracts';
import type { KeySpec, Selection, ToolApi } from '@pcbk/ui';
import { COMPONENT_SCALE_MAX, COMPONENT_SCALE_MIN, selectComponent } from '../contract';
import { commandError } from './errors';
import { placementEt } from './i18n/et';
import { decimalValue, footprintName } from './placement';
import { ChangeFootprint } from './ChangeFootprint';

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

function ScaleField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string>();
  return (
    <Field
      label={label}
      inputMode="decimal"
      value={draft ?? number.format(value)}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={(event) => {
        const parsed = decimalValue(event.currentTarget.value, true);
        setDraft(undefined);
        if (parsed === undefined) return;
        const scale = Math.max(COMPONENT_SCALE_MIN, Math.min(parsed, COMPONENT_SCALE_MAX));
        if (scale !== value) onCommit(scale);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
        event.preventDefault();
        event.currentTarget.blur();
      }}
    />
  );
}

export function PlacementSection({ id, ids }: { id: string; ids: IdGen }) {
  const engine = useEngine();
  const component = useSnapshot((snapshot) => selectComponent(snapshot, id));
  const board = component?.board;
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState(false);
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
      <details className="pcbk-component-footprint">
        <summary>{`${text.footprint} · ${footprintName(board.footprint)} · ${placementEt.change.pinCount(component.pins.length)}`}</summary>
        {editing ? (
          <ChangeFootprint id={id} ids={ids} onClose={() => setEditing(false)} />
        ) : (
          <Button onClick={() => setEditing(true)}>{placementEt.change.edit}</Button>
        )}
      </details>
      <dl>
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
        <ScaleField
          label={text.scaleX}
          value={board.scaleX}
          onCommit={(scaleX) =>
            report(engine.execute('components.setScale', { id, scaleX, scaleY: board.scaleY }))
          }
        />
        <ScaleField
          label={text.scaleY}
          value={board.scaleY}
          onCommit={(scaleY) =>
            report(engine.execute('components.setScale', { id, scaleX: board.scaleX, scaleY }))
          }
        />
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
