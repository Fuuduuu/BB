import { boardPads } from '../geometry/board';
import type { BoardDoc } from '../model/board';
import type { Component } from '../model/component';
import type { Connection, Junction } from '../model/connection';
import type { EndRef, Layer } from '../model/primitives';

export type DrawingKind = NonNullable<Connection['board']>['kind'];

interface DrawingComponent extends Pick<Component, 'id' | 'board'> {
  readonly pins: readonly Pick<Component['pins'][number], 'id'>[];
}

export interface DrawingPositions {
  readonly components: readonly DrawingComponent[];
  readonly junctions: readonly Pick<Junction, 'id' | 'board'>[];
  readonly scale: Pick<BoardDoc['scale'], 'pxPerMm'>;
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
  const { c, p } = end.pin;
  const part = doc.components.find(({ id }) => id === c);
  const board = part?.board;
  if (!board || !part.pins.some(({ id }) => id === p)) return false;

  // A logical connection is drawn to the first pad mapped to its pin.
  const [pad] = boardPads(board, [p], doc.scale.pxPerMm);
  return pad !== undefined && (kind === 'wire' || pad.through || board.side === layer);
}
