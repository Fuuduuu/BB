import { useMemo, useState } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import type { AppHost, IdGen, Snapshot } from '@pcbk/contracts';
import { Button, Dialog, Field, useSessionStore } from '@pcbk/ui';
import { netlistCsv, netRoleColor, roleSwatchColor } from '../contract';
import type { AssignNetParams } from '../contract';
import { netsEt } from './i18n/et';
import { netAnchor, netCommandError, netDetails, pinMembers } from './net-details';
import type { ConnectionPoints, Net } from './net-details';
import { NetRoleDialog } from './NetRoleDialog';
import './nets-tab.css';

type NetsTabProps = {
  ids: IdGen;
  connectionPoints: ConnectionPoints;
  saveTextFile?: AppHost['saveTextFile'];
};

function Swatch({ color }: { color: string }) {
  return <span className="pcbk-net-swatch" style={{ backgroundColor: color }} aria-hidden="true" />;
}

function NetList({
  snapshot,
  nets,
  select,
}: {
  snapshot: Snapshot;
  nets: readonly Net[];
  select(net: Net): void;
}) {
  return (
    <ul className="pcbk-net-list">
      {nets.map((net) => {
        const role = snapshot.doc.roles.find(({ id }) => id === net.roleId);
        const { color, conflict } = netRoleColor(snapshot, net.key);
        const count = netsEt.memberCount(net.members.length);
        const label = [net.name, count, conflict ? netsEt.conflict : role?.label]
          .filter(Boolean)
          .join(' · ');
        return (
          <li key={net.key}>
            <button
              type="button"
              className="pcbk-net-row"
              aria-label={label}
              onClick={() => select(net)}
            >
              <span className="pcbk-net-row__name">
                {net.named ? <strong>{net.name}</strong> : <em>{net.name}</em>}
                {conflict && (
                  <span className="pcbk-net-conflict-icon" title={netsEt.conflict}>
                    ⚠
                  </span>
                )}
              </span>
              <span className="pcbk-net-row__meta">{count}</span>
              {role && color && (
                <span className="pcbk-net-chip">
                  <Swatch color={color} />
                  {role.label}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function RoleChips({
  roles,
  selectedRole,
  select,
  addRole,
}: {
  roles: Snapshot['doc']['roles'];
  selectedRole?: string;
  select?: (id: string) => void;
  addRole(): void;
}) {
  return (
    <div className="pcbk-net-roles">
      {roles.map((role) => {
        const contents = (
          <>
            <Swatch color={roleSwatchColor(role)} />
            {role.label}
          </>
        );
        return select ? (
          <Button
            key={role.id}
            className="pcbk-net-chip"
            aria-pressed={role.id === selectedRole}
            onClick={() => select(role.id)}
          >
            {contents}
          </Button>
        ) : (
          <span key={role.id} className="pcbk-net-chip">
            {contents}
          </span>
        );
      })}
      <Button variant="ghost" onClick={addRole}>
        {netsEt.newRole}
      </Button>
    </div>
  );
}

function NetView({
  ids,
  connectionPoints,
  snapshot,
  net,
  nets,
  goBack,
  addRole,
}: NetsTabProps & {
  snapshot: Snapshot;
  net: Net;
  nets: readonly Net[];
  goBack(): void;
  addRole(): void;
}) {
  const engine = useEngine();
  const pins = useMemo(() => pinMembers(snapshot.doc.components), [snapshot.doc.components]);
  const details = useMemo(
    () => netDetails(snapshot, net, pins, connectionPoints),
    [snapshot, net, pins, connectionPoints],
  );
  const anchor = netAnchor(net, pins);
  const [draft, setDraft] = useState<string>();
  const [choosingRole, setChoosingRole] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string>();
  const name = net.named ? net.name : '';
  const otherNets = nets.filter(({ key }) => key !== net.key);
  const conflictRoles = net.conflictingRoles.map(
    (id) => snapshot.doc.roles.find((role) => role.id === id)?.label ?? id,
  );

  function assign(change: Pick<AssignNetParams, 'name' | 'roleId'>) {
    if (!anchor) return false;
    const result = engine.execute('nets.assign', { anchor, labelId: ids.newId('lbl'), ...change });
    setError(result.ok ? undefined : netCommandError(result.error));
    return result.ok;
  }

  function saveName() {
    if (draft === undefined) return;
    const next = draft.trim();
    if (next === name || assign({ name: next })) setDraft(undefined);
  }

  function join(other: Net) {
    const target = netAnchor(other, pins);
    if (!anchor || !target) return;
    const result = engine.execute('nets.join', {
      connectionId: ids.newId('con'),
      a: anchor,
      b: target,
    });
    setError(result.ok ? undefined : netCommandError(result.error));
    if (result.ok) setJoining(false);
  }

  return (
    <>
      <Button className="pcbk-net-back" variant="ghost" onClick={goBack}>
        {netsEt.back}
      </Button>
      {net.roleConflict && (
        <div className="pcbk-net-warning">
          <p role="alert">{netsEt.conflictWarning(conflictRoles.join(' + '))}</p>
          <div className="pcbk-net-actions">
            <Button
              onClick={() =>
                useSessionStore.getState().setSelection({
                  items: details.connections.map(({ id }) => ({ kind: 'connection', id })),
                })
              }
            >
              {netsEt.showConnections}
            </Button>
            <Button onClick={() => setChoosingRole(true)}>{netsEt.chooseRole}</Button>
          </div>
        </div>
      )}
      <Field
        label={netsEt.name}
        value={draft ?? name}
        placeholder={net.named ? undefined : net.name}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={saveName}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            saveName();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setDraft(undefined);
          }
        }}
      />
      {(!net.roleConflict || choosingRole) && (
        <RoleChips
          roles={snapshot.doc.roles}
          selectedRole={net.roleId}
          select={(roleId) => {
            if (assign({ roleId })) setChoosingRole(false);
          }}
          addRole={addRole}
        />
      )}
      {error && (
        <p className="bb-field__error" role="alert">
          {error}
        </p>
      )}
      <ul className="pcbk-net-list">
        {details.pins.map(({ key, c, p, label }) => (
          <li key={key}>
            <Button
              variant="ghost"
              onClick={() =>
                useSessionStore
                  .getState()
                  .setSelection({ items: [{ kind: 'pin', id: p, componentId: c }] })
              }
            >
              {label}
            </Button>
          </li>
        ))}
      </ul>
      <p className="pcbk-net-fact">{netsEt.junctionCount(details.junctions)}</p>
      <p className="pcbk-net-fact">{netsEt.traceLength(details.lengthMm)}</p>
      {details.measurements.length > 0 && (
        <section className="pcbk-net-measurements">
          <h3>{netsEt.measurements}</h3>
          <ul className="pcbk-net-list">
            {details.measurements.map(({ id, text }) => (
              <li key={id}>{text}</li>
            ))}
          </ul>
        </section>
      )}
      <Button disabled={!anchor || !otherNets.length} onClick={() => setJoining(true)}>
        {netsEt.join}
      </Button>
      {joining && (
        <Dialog
          open
          title={netsEt.join}
          onClose={() => {
            setJoining(false);
            setError(undefined);
          }}
        >
          <NetList snapshot={snapshot} nets={otherNets} select={join} />
          {error && (
            <p className="bb-field__error" role="alert">
              {error}
            </p>
          )}
          <div className="pcbk-net-actions">
            <Button
              onClick={() => {
                setJoining(false);
                setError(undefined);
              }}
            >
              {netsEt.cancel}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function NetsNavigator({
  ids,
  connectionPoints,
  saveTextFile,
  snapshot,
}: NetsTabProps & { snapshot: Snapshot }) {
  const [selected, setSelected] = useState<string>();
  const [addingRole, setAddingRole] = useState(false);
  const [exportError, setExportError] = useState(false);
  const derived = snapshot.derived.nets;
  const nets = derived?.list ?? [];
  const selectedKey = selected === undefined ? undefined : derived?.netOf[selected];
  const active = nets.find(({ key }) => key === selectedKey);
  const openRole = () => setAddingRole(true);

  async function exportNetlist() {
    if (!saveTextFile || !nets.length) return;
    setExportError(false);
    const name = snapshot.doc.name.replace(/[\\/:*?"<>|]/g, '').trim();
    try {
      await saveTextFile(netsEt.exportFileName(name), netlistCsv(snapshot));
    } catch {
      setExportError(true);
    }
  }

  return (
    <div className="pcbk-nets-tab">
      {active ? (
        <NetView
          key={active.key}
          ids={ids}
          connectionPoints={connectionPoints}
          snapshot={snapshot}
          net={active}
          nets={nets}
          goBack={() => setSelected(undefined)}
          addRole={openRole}
        />
      ) : (
        <>
          <NetList snapshot={snapshot} nets={nets} select={(net) => setSelected(net.key)} />
          <Button disabled={!saveTextFile || !nets.length} onClick={() => void exportNetlist()}>
            {netsEt.exportNetlist}
          </Button>
          {exportError && (
            <p className="bb-field__error" role="alert">
              {netsEt.exportFailed}
            </p>
          )}
          <RoleChips roles={snapshot.doc.roles} addRole={openRole} />
        </>
      )}
      {addingRole && <NetRoleDialog ids={ids} onClose={() => setAddingRole(false)} />}
    </div>
  );
}

export function NetsTab(props: NetsTabProps) {
  const snapshot = useSnapshot((current) => current);
  return <NetsNavigator key={snapshot.sessionId} {...props} snapshot={snapshot} />;
}
