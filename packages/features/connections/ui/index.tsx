import type { IdGen, Snapshot } from '@pcbk/contracts';
import type { EndRef } from '@pcbk/domain';
import type { Selection, UiModule } from '@pcbk/ui';
import { AirLinesToggle } from './air-lines-view';
import { connectionsEt } from './i18n/et';
import { airLinesLayer, junctionsLayer } from './layers';

function endLabel({ doc }: Snapshot, end: EndRef): string | null {
  if ('junction' in end) return connectionsEt.junctionEnd;
  const component = doc.components.find(({ id }) => id === end.pin.c);
  const pin = component?.pins.find(({ id }) => id === end.pin.p);
  return component && pin ? `${component.ref}.${pin.name || pin.id}` : null;
}

function idsOfKind(selection: Selection, kind: string): string[] {
  return selection.items.filter((item) => item.kind === kind).map(({ id }) => id);
}

function junctionConnectionCount({ doc }: Snapshot, ids: readonly string[]): number {
  const selected = new Set(ids);
  const touches = (end: EndRef) => 'junction' in end && selected.has(end.junction);
  return doc.connections.filter(({ a, b }) => touches(a) || touches(b)).length;
}

export function createConnectionsUi(ids: IdGen): UiModule {
  return {
    id: 'connections',
    title: connectionsEt.title,
    canvasLayers: [airLinesLayer, junctionsLayer],
    topBar: [{ id: 'connections.airLines', render: () => <AirLinesToggle /> }],
    keys: [
      {
        id: 'connections.quickConnect',
        key: 'C',
        run(api, selection) {
          const ends = selection.items.flatMap(({ kind, id, componentId }) =>
            kind === 'pin' && componentId ? [{ pin: { c: componentId, p: id } }] : [],
          );
          if (ends.length < 2) return false;
          const items = ends.slice(1).map((b, index) => ({
            id: ids.newId('con'),
            a: ends[index]!,
            b,
          }));
          return api.execute('connections.add', { items, basis: 'assumed', skipJoined: true }).ok;
        },
      },
    ],
    selectionKinds: [
      {
        kind: 'connection',
        label(snapshot, item) {
          const connection = snapshot.doc.connections.find(({ id }) => id === item.id);
          if (!connection) return null;
          const a = endLabel(snapshot, connection.a);
          const b = endLabel(snapshot, connection.b);
          return a && b ? `${a} – ${b}` : null;
        },
        exists: ({ doc }, item) => doc.connections.some(({ id }) => id === item.id),
        deleteId: ({ doc }, item) => doc.connections.find(({ id }) => id === item.id)?.id ?? null,
      },
      {
        kind: 'junction',
        label: (snapshot, item) =>
          snapshot.doc.junctions.some(({ id }) => id === item.id)
            ? connectionsEt.junction(junctionConnectionCount(snapshot, [item.id]))
            : null,
        exists: ({ doc }, item) => doc.junctions.some(({ id }) => id === item.id),
        deleteId: ({ doc }, item) => doc.junctions.find(({ id }) => id === item.id)?.id ?? null,
      },
    ],
    contextMenu: [
      {
        id: 'connections.remove',
        appliesTo: ['connection'],
        order: 0,
        label: () => connectionsEt.deleteConnection,
        run(api, selection) {
          const ids = idsOfKind(selection, 'connection');
          return ids.length > 0 && api.execute('connections.remove', { ids }).ok;
        },
      },
      {
        id: 'junctions.remove',
        appliesTo: ['junction'],
        order: 0,
        label: (snapshot, selection) =>
          connectionsEt.deleteJunction(
            junctionConnectionCount(snapshot, idsOfKind(selection, 'junction')),
          ),
        run(api, selection) {
          const ids = idsOfKind(selection, 'junction');
          return ids.length > 0 && api.execute('junctions.remove', { ids }).ok;
        },
      },
    ],
  };
}
