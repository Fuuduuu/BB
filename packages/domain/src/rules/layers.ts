import { boardPads } from '../geometry/board';
import type { BoardDoc } from '../model/board';
import type { Component } from '../model/component';
import type { Connection, Junction } from '../model/connection';
import type { EndRef, Layer, PinRef, Vec2 } from '../model/primitives';

export type DrawingKind = NonNullable<Connection['board']>['kind'];

interface DrawingComponent extends Pick<Component, 'id' | 'board'> {
  readonly pins: readonly Pick<Component['pins'][number], 'id'>[];
}

export interface DrawingPositions {
  readonly components: readonly DrawingComponent[];
  readonly junctions: readonly Pick<Junction, 'id' | 'board'>[];
  readonly scale: Pick<BoardDoc['scale'], 'pxPerMm'>;
}

function firstDrawingPad(doc: DrawingPositions, { c, p }: PinRef) {
  const part = doc.components.find(({ id }) => id === c);
  const board = part?.board;
  if (!board || !part.pins.some(({ id }) => id === p)) return;
  // A logical connection is drawn to the first pad mapped to its pin.
  const [pad] = boardPads(board, [p], doc.scale.pxPerMm);
  if (pad) return { pad, side: board.side };
}

export function drawingEndpoint(doc: DrawingPositions, end: EndRef): Vec2 | undefined {
  if ('junction' in end) {
    return doc.junctions.find(({ id }) => id === end.junction)?.board?.at;
  }
  return firstDrawingPad(doc, end.pin)?.pad.at;
}

export function endAcceptsDrawing(
  doc: DrawingPositions,
  end: EndRef,
  kind: DrawingKind,
  layer: Layer,
): boolean {
  if ('junction' in end) {
    const board = doc.junctions.find(({ id }) => id === end.junction)?.board;
    return board !== undefined && (kind === 'wire' || board.layer === layer);
  }
  const placement = firstDrawingPad(doc, end.pin);
  return (
    placement !== undefined &&
    (kind === 'wire' || placement.pad.through || placement.side === layer)
  );
}
