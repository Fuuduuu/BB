import type { Snapshot } from '@pcbk/contracts';
import type { PinRef, Vec2 } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import {
  pinKey,
  RuleRejected,
  RuleTargetNotFound,
  validateJunctionAttachment,
} from '@pcbk/domain/rules';
import type { HitDrag } from '@pcbk/ui';
import { JUNCTION_DRAG_OWNER } from './connection-preview';
import { visiblePadHalf } from './pad-highlight';
import type { BoardPad } from './pad-highlight';

type Doc = Snapshot['doc'];
type Candidate = { pin: PinRef; pad: BoardPad; key: string };
const padCache = new WeakMap<Doc, Candidate[]>();

function orderedPads(doc: Doc): Candidate[] {
  const cached = padCache.get(doc);
  if (cached) return cached;
  const pads: Candidate[] = [];
  for (const { id, board, pins } of doc.components) {
    if (!board) continue;
    for (const pad of boardPads(
      board,
      pins.map((pin) => pin.id),
      doc.scale.pxPerMm,
    )) {
      const pin = { c: id, p: pad.pinId };
      pads.push({ pin, pad, key: pinKey(pin) });
    }
  }
  pads.sort((a, b) => (a.key < b.key ? -1 : a.key === b.key ? 0 : 1));
  padCache.set(doc, pads);
  return pads;
}

function isInsidePad(at: Vec2, pad: BoardPad, zoom: number) {
  const angle = (pad.angleDeg * Math.PI) / 180;
  const dx = at.x - pad.at.x;
  const dy = at.y - pad.at.y;
  const x = Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle));
  const y = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
  const half = visiblePadHalf(pad, zoom);
  if (pad.shape === 'circle') return Math.hypot(x / half.x, y / half.y) <= 1;
  if (pad.shape === 'rect') return x <= half.x && y <= half.y;
  const radius = Math.min(half.x, half.y);
  return Math.hypot(Math.max(0, x - half.x + radius), Math.max(0, y - half.y + radius)) <= radius;
}

export function junctionAttachment(doc: Doc, id: string, at: Vec2, zoom: number) {
  for (const hit of orderedPads(doc)) {
    if (!isInsidePad(at, hit.pad, zoom)) continue;
    try {
      validateJunctionAttachment(doc, id, hit.pin);
      return hit;
    } catch (error) {
      if (!(error instanceof RuleRejected || error instanceof RuleTargetNotFound)) throw error;
    }
  }
}

export function junctionDrag(id: string, zoom: number): HitDrag {
  return {
    owner: JUNCTION_DRAG_OWNER,
    commit(delta, api) {
      const { doc } = api.snapshot();
      const origin = doc.junctions.find((junction) => junction.id === id)?.board?.at;
      if (!origin) return;
      const at = { x: origin.x + delta.x, y: origin.y + delta.y };
      const target = junctionAttachment(doc, id, at, zoom);
      if (target) api.execute('junctions.attachToPin', { id, pin: target.pin });
      else api.execute('junctions.move', { id, at });
    },
  };
}
