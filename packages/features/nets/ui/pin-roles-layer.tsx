import type { Snapshot } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import { pinKey } from '@pcbk/domain/rules';
import { useSessionStore } from '@pcbk/ui';
import type { LayerSpec, TranslatePreviewData } from '@pcbk/ui';
import { Fragment } from 'react';
import { netRoleColor } from '../contract';

type RolePad = {
  componentId: string;
  memberKey: string;
  at: Vec2;
  halfPx: Vec2;
  rectangular: boolean;
  color?: string;
  conflict: boolean;
};
type RolePadsCache = { nets: Snapshot['derived']['nets']; pads: RolePad[] };
const rolePadsCache = new WeakMap<Snapshot['doc'], RolePadsCache>();

function rolePads(snapshot: Snapshot): RolePad[] {
  const {
    doc,
    derived: { nets },
  } = snapshot;
  if (!nets?.list.length) return [];
  const cached = rolePadsCache.get(doc);
  if (cached?.nets === nets) return cached.pads;
  const pads: RolePad[] = [];
  for (const { id, pins, board } of doc.components) {
    if (!board) continue;
    const styles = new Map<string, { memberKey: string; color?: string; conflict: boolean }>();
    for (const { id: pinId } of pins) {
      const memberKey = pinKey({ c: id, p: pinId });
      const style = netRoleColor(snapshot, memberKey);
      if (style.color || style.conflict) styles.set(pinId, { memberKey, ...style });
    }
    if (styles.size === 0) continue;
    for (const { pinId, at, halfPx, shape } of boardPads(
      board,
      [...styles.keys()],
      doc.scale.pxPerMm,
    )) {
      pads.push({
        componentId: id,
        at,
        halfPx,
        rectangular: shape === 'rect',
        ...styles.get(pinId)!,
      });
    }
  }
  rolePadsCache.set(doc, { nets, pads });
  return pads;
}

function PinRoleRings({ snapshot, preview, zoom }: Parameters<LayerSpec['render']>[0]) {
  const selection = useSessionStore((state) => state.selection.items);
  const pads = rolePads(snapshot);
  if (pads.length === 0) return null;
  const selected = new Set(
    selection.flatMap(({ kind, id, componentId }) =>
      kind === 'pin' && componentId ? [pinKey({ c: componentId, p: id })] : [],
    ),
  );
  const motion = preview?.owner === 'select' ? (preview.data as TranslatePreviewData) : undefined;
  const movingComponents = new Set(
    motion?.items.filter(({ kind }) => kind === 'component').map(({ id }) => id),
  );
  return (
    <g data-layer="nets.pinRoles" pointerEvents="none" aria-hidden="true">
      {pads.map(({ componentId, memberKey, at, halfPx, rectangular, color, conflict }, index) => {
        const delta = movingComponents.has(componentId) ? motion : undefined;
        const isSelected = selected.has(memberKey);
        // Keep the role and conflict strokes clear of the selected pad outline.
        const extension = isSelected ? 2 / zoom : 0;
        const halfX = Math.max(halfPx.x, 2.5 / zoom) + extension;
        const halfY = Math.max(halfPx.y, 2.5 / zoom) + extension;
        const radius = rectangular ? Math.hypot(halfX, halfY) : Math.max(halfX, halfY);
        const geometry = {
          cx: at.x + (delta?.dx ?? 0),
          cy: at.y + (delta?.dy ?? 0),
          r: radius + (isSelected ? 3 : 2) / zoom,
          fill: 'none',
          vectorEffect: 'non-scaling-stroke',
        } as const;
        return (
          <Fragment key={`${memberKey}:${index}`}>
            {conflict && <circle {...geometry} stroke="var(--danger)" strokeWidth={3.5} />}
            <circle
              {...geometry}
              data-pin-role={memberKey}
              stroke={color ?? 'var(--ink-3)'}
              strokeWidth={1.5}
            />
          </Fragment>
        );
      })}
    </g>
  );
}

export const pinRolesLayer: LayerSpec = {
  id: 'nets.pinRoles',
  z: 52,
  previewOwners: ['select'],
  render: (props) => <PinRoleRings {...props} />,
};
