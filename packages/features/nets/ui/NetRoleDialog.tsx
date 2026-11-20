import { useId, useState } from 'react';
import { useEngine } from '@pcbk/client';
import type { IdGen } from '@pcbk/contracts';
import type { NetRole } from '@pcbk/domain';
import { parseReading } from '@pcbk/domain/measure/reading';
import { Button, Dialog, Field } from '@pcbk/ui';
import { netsEt } from './i18n/et';
import { netCommandError } from './net-details';

const roleKinds = Object.entries(netsEt.roleKinds);

export function NetRoleDialog({ ids, onClose }: { ids: IdGen; onClose(): void }) {
  const engine = useEngine();
  const kindId = useId();
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<NetRole['kind']>('unknown');
  const [voltage, setVoltage] = useState('');
  const [color, setColor] = useState('#607068');
  const [voltageError, setVoltageError] = useState<string>();
  const [commandError, setCommandError] = useState<string>();

  return (
    <Dialog open title={netsEt.newRoleTitle} onClose={onClose}>
      <form
        className="pcbk-net-form"
        onSubmit={(event) => {
          event.preventDefault();
          const name = label.trim();
          if (!name) return;
          const reading = voltage.trim() ? parseReading(voltage, 'voltage') : undefined;
          if (reading === null) {
            setVoltageError(netsEt.invalidVoltage);
            return;
          }
          const result = engine.execute('roles.add', {
            role: {
              id: ids.newId('rol'),
              label: name,
              kind,
              color,
              ...(reading ? { nominalV: reading.value } : {}),
            },
          });
          if (result.ok) onClose();
          else setCommandError(netCommandError(result.error));
        }}
      >
        <Field
          label={netsEt.name}
          value={label}
          required
          onChange={(event) => setLabel(event.target.value)}
        />
        <div className="bb-field">
          <label htmlFor={kindId} className="bb-field__label">
            {netsEt.kind}
          </label>
          <select
            id={kindId}
            className="bb-input"
            value={kind}
            onChange={(event) => setKind(event.target.value as NetRole['kind'])}
          >
            {roleKinds.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </div>
        <Field
          label={netsEt.nominalVoltage}
          inputMode="decimal"
          value={voltage}
          error={voltageError}
          onChange={(event) => {
            setVoltage(event.target.value);
            setVoltageError(undefined);
          }}
        />
        <Field
          label={netsEt.color}
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
        />
        {commandError && (
          <p className="bb-field__error" role="alert">
            {commandError}
          </p>
        )}
        <div className="pcbk-net-actions">
          <Button onClick={onClose}>{netsEt.cancel}</Button>
          <Button variant="primary" type="submit" disabled={!label.trim()}>
            {netsEt.add}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
