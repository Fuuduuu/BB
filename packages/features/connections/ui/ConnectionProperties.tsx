import { useSnapshot } from '@pcbk/client';
import type { Snapshot } from '@pcbk/contracts';
import type { EndRef } from '@pcbk/domain';
import { endKey } from '@pcbk/domain/rules';
import type { Selection } from '@pcbk/ui';
import { connectionsEt } from './i18n/et';

export function endLabel({ doc }: Snapshot, end: EndRef): string | null {
  if ('junction' in end) return connectionsEt.junctionEnd;
  const component = doc.components.find(({ id }) => id === end.pin.c);
  const pin = component?.pins.find(({ id }) => id === end.pin.p);
  return component && pin ? `${component.ref}.${pin.name || pin.id}` : null;
}

export function ConnectionProperties({
  selection,
  netName,
}: {
  selection: Selection;
  netName(snapshot: Snapshot, memberKey: string): string | undefined;
}) {
  const snapshot = useSnapshot((current) => current);
  const [item] = selection.items;
  if (selection.items.length !== 1 || item?.kind !== 'connection') return null;
  const connection = snapshot.doc.connections.find(({ id }) => id === item.id);
  if (!connection) return null;
  const from = endLabel(snapshot, connection.a);
  const to = endLabel(snapshot, connection.b);
  if (from === null || to === null) return null;

  const memberKey = endKey(connection.a);
  const nets = snapshot.derived.nets;
  const name = nets
    ? (netName(snapshot, memberKey) ??
      nets.list.find(({ key }) => key === nets.netOf[memberKey])?.name)
    : undefined;
  const { board, basis } = connection;
  const drawing = board
    ? {
        title:
          board.kind === 'wire'
            ? connectionsEt.traceWire
            : board.layer === 'top'
              ? connectionsEt.traceTop
              : connectionsEt.traceBottom,
        width: connectionsEt.traceLength(board.widthMm),
      }
    : undefined;

  return (
    <section>
      <p className="bb-mono">{`${from} → ${to}`}</p>
      <p>{basis === 'visual' ? connectionsEt.basisVisual : connectionsEt.basisAssumed}</p>
      {name !== undefined && <p>{connectionsEt.networkLabel(name)}</p>}
      {drawing && <p>{`${drawing.title} · ${drawing.width}`}</p>}
    </section>
  );
}
