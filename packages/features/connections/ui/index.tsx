import type { IdGen, Snapshot } from '@pcbk/contracts';
import type { EndRef, Vec2 } from '@pcbk/domain';
import { useViewStore } from '@pcbk/ui';
import type { Selection, UiModule } from '@pcbk/ui';
import { ConnectionProperties, endLabel } from './ConnectionProperties';
import {
  createTraceToolSpec,
  resetTraceTool,
  startExistingTrace,
  startTraceFrom,
} from './TraceTool';
import { TraceHint } from './TraceHint';
import { AirLinesToggle } from './air-lines-view';
import { connectionPoints, projectDrawingSegment } from './connection-geometry';
import { connectionsEt } from './i18n/et';
import { createAirLinesLayer, createTracesLayer, junctionsLayer } from './layers';
import type { ConnectionRoleColor } from './layers';
import { distance } from './trace-geometry';
import { connectionEditingLayer, selectedConnectionId } from './connection-editing-layer';
import { createTraceLabelsLayer } from './trace-labels-layer';
import type { ConnectionNetName } from './trace-labels-layer';

export { connectionPoints } from './connection-geometry';

function idsOfKind(selection: Selection, kind: string): string[] {
  return selection.items.filter((item) => item.kind === kind).map(({ id }) => id);
}

function selectedConnection({ doc }: Snapshot, selection: Selection) {
  const id = selectedConnectionId(selection);
  return id === undefined ? undefined : doc.connections.find((connection) => connection.id === id);
}

function selectedPin(selection: Selection): EndRef | undefined {
  const item = selection.items.find(({ kind, componentId }) => kind === 'pin' && componentId);
  return item?.componentId ? { pin: { c: item.componentId, p: item.id } } : undefined;
}

function nearestPoint(points: readonly Vec2[], at: Vec2) {
  let nearest: { index: number; point: Vec2; distance: number } | undefined;
  for (const [index, point] of points.entries()) {
    const gap = distance(point, at);
    if (!nearest || gap < nearest.distance) nearest = { index, point, distance: gap };
  }
  return nearest;
}

function junctionConnectionCount({ doc }: Snapshot, ids: readonly string[]): number {
  const selected = new Set(ids);
  const touches = (end: EndRef) => 'junction' in end && selected.has(end.junction);
  return doc.connections.filter(({ a, b }) => touches(a) || touches(b)).length;
}

export function createConnectionsUi(
  ids: IdGen,
  { roleColor, netName }: { roleColor: ConnectionRoleColor; netName: ConnectionNetName },
): UiModule {
  return {
    id: 'connections',
    title: connectionsEt.title,
    canvasLayers: [
      createTracesLayer(roleColor),
      createAirLinesLayer(roleColor),
      junctionsLayer,
      connectionEditingLayer,
      createTraceLabelsLayer(netName),
    ],
    tools: [createTraceToolSpec(ids)],
    topBar: [{ id: 'connections.airLines', render: () => <AirLinesToggle /> }],
    bottomBar: [{ id: 'connections.trace', render: () => <TraceHint /> }],
    onSessionReset: resetTraceTool,
    contextSections: [
      {
        id: 'connections.properties',
        appliesTo: ['connection'],
        order: 0,
        render: ({ selection }) => <ConnectionProperties selection={selection} netName={netName} />,
      },
    ],
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
        id: 'connections.insertWaypoint',
        appliesTo: ['connection'],
        order: -3,
        label: () => connectionsEt.insertWaypoint,
        available: (snapshot, selection) => !!selectedConnection(snapshot, selection)?.board,
        run(api, selection, at) {
          const snapshot = api.snapshot();
          const connection = selectedConnection(snapshot, selection);
          if (!connection?.board) return false;
          const points = connectionPoints(snapshot.doc, connection);
          if (!points) return false;
          const { kind } = connection.board;
          const projections = points
            .slice(1)
            .map((point, index) => projectDrawingSegment(at, points[index]!, point, kind));
          const nearest = nearestPoint(projections, at);
          return (
            !!nearest &&
            api.execute('connections.insertWaypoint', {
              id: connection.id,
              index: nearest.index,
              at: nearest.point,
            }).ok
          );
        },
      },
      {
        id: 'connections.removeWaypoint',
        appliesTo: ['connection'],
        order: -2,
        label: () => connectionsEt.removeWaypoint,
        available: (snapshot, selection) =>
          !!selectedConnection(snapshot, selection)?.board?.waypoints.length,
        run(api, selection, at) {
          const connection = selectedConnection(api.snapshot(), selection);
          if (!connection?.board) return false;
          const nearest = nearestPoint(connection.board.waypoints, at);
          const zoom = useViewStore.getState().boardView.zoom;
          return (
            !!nearest &&
            nearest.distance * zoom <= 8 &&
            api.execute('connections.removeWaypoint', {
              id: connection.id,
              index: nearest.index,
            }).ok
          );
        },
      },
      {
        id: 'connections.drawOnBoard',
        appliesTo: ['connection'],
        order: -1,
        label: () => connectionsEt.drawOnBoard,
        available(snapshot, selection) {
          const connection = selectedConnection(snapshot, selection);
          return !!connection && !connection.board;
        },
        run(api, selection) {
          const connection = selectedConnection(api.snapshot(), selection);
          return !!connection && startExistingTrace(api, connection.id);
        },
      },
      {
        id: 'connections.removeBoardDrawing',
        appliesTo: ['connection'],
        order: -1,
        label: () => connectionsEt.removeBoardDrawing,
        available: (snapshot, selection) => !!selectedConnection(snapshot, selection)?.board,
        run(api, selection) {
          const connection = selectedConnection(api.snapshot(), selection);
          return (
            !!connection?.board &&
            api.execute('connections.removeBoardDrawing', { ids: [connection.id] }).ok
          );
        },
      },
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
      {
        id: 'connections.resetLabelOffset',
        appliesTo: ['connection'],
        order: 1,
        label: () => connectionsEt.resetLabelOffset,
        available: (snapshot, selection) =>
          selectedConnection(snapshot, selection)?.board?.labelOffset !== undefined,
        run(api, selection) {
          const connection = selectedConnection(api.snapshot(), selection);
          return (
            !!connection?.board?.labelOffset &&
            api.execute('connections.setLabelOffset', { id: connection.id, offset: null }).ok
          );
        },
      },
      {
        id: 'connections.startTrace',
        appliesTo: ['pin'],
        order: 10,
        label: () => connectionsEt.startTrace,
        run(api, selection, _at, target) {
          const end = selectedPin(target?.kind === 'pin' ? { items: [target] } : selection);
          return !!end && startTraceFrom(api, end);
        },
      },
    ],
  };
}
