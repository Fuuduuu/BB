import type { Snapshot } from '@pcbk/contracts';
import type { BoardPlacement, Vec2 } from '@pcbk/domain';
import { boardPads } from '@pcbk/domain/geometry';
import { pinKey } from '@pcbk/domain/rules';
import { useSessionStore } from '@pcbk/ui';
import type { LayerSpec, TranslatePreviewData } from '@pcbk/ui';
import { Fragment, memo, useMemo } from 'react';
import { previewBoardScale, readScaleDrag, SCALE_DRAG_OWNER } from '../../components/contract';
import { netRoleColor } from '../contract';

type RoleStyle = {
  memberKey: string;
  color?: string;
  conflict: boolean;
};
type RolePad = RoleStyle & {
  key: string;
  at: Vec2;
  halfPx: Vec2;
  rectangular: boolean;
};
type ComponentRolePads = {
  id: string;
  board: BoardPlacement;
  styles: ReadonlyMap<string, RoleStyle>;
  pads: RolePad[];
};
type RolePadsCache = { nets: Snapshot['derived']['nets']; groups: ComponentRolePads[] };
const rolePadsCache = new WeakMap<Snapshot['doc'], RolePadsCache>();

function buildRolePads(
  board: BoardPlacement,
  styles: ReadonlyMap<string, RoleStyle>,
  pxPerMm: number,
): RolePad[] {
  return boardPads(board, [...styles.keys()], pxPerMm).map(
    ({ pinId, at, halfPx, shape }, index) => {
      const style = styles.get(pinId)!;
      return {
        key: `${style.memberKey}:${index}`,
        at,
        halfPx,
        rectangular: shape === 'rect',
        ...style,
      };
    },
  );
}

function rolePads(snapshot: Snapshot): ComponentRolePads[] {
  const {
    doc,
    derived: { nets },
  } = snapshot;
  if (!nets?.list.length) return [];
  const cached = rolePadsCache.get(doc);
  if (cached?.nets === nets) return cached.groups;
  const groups: ComponentRolePads[] = [];
  for (const { id, pins, board } of doc.components) {
    if (!board) continue;
    const styles = new Map<string, RoleStyle>();
    for (const { id: pinId } of pins) {
      const memberKey = pinKey({ c: id, p: pinId });
      const style = netRoleColor(snapshot, memberKey);
      if (style.color || style.conflict) styles.set(pinId, { memberKey, ...style });
    }
    if (styles.size === 0) continue;
    const pads = buildRolePads(board, styles, doc.scale.pxPerMm);
    if (pads.length > 0) groups.push({ id, board, styles, pads });
  }
  rolePadsCache.set(doc, { nets, groups });
  return groups;
}

type ComponentRingsProps = {
  pads: readonly RolePad[];
  selected: ReadonlySet<string> | undefined;
  dx: number;
  dy: number;
  zoom: number;
};

function sameSelectedPins(
  left: ReadonlySet<string> | undefined,
  right: ReadonlySet<string> | undefined,
) {
  return (
    left === right ||
    (left !== undefined &&
      right !== undefined &&
      left.size === right.size &&
      [...left].every((memberKey) => right.has(memberKey)))
  );
}

const ComponentRoleRings = memo(
  function ComponentRoleRings({ pads, selected, dx, dy, zoom }: ComponentRingsProps) {
    return pads.map(({ key, memberKey, at, halfPx, rectangular, color, conflict }) => {
      const isSelected = selected?.has(memberKey) ?? false;
      // Keep the role and conflict strokes clear of the selected pad outline.
      const extension = isSelected ? 2 / zoom : 0;
      const halfX = Math.max(halfPx.x, 2.5 / zoom) + extension;
      const halfY = Math.max(halfPx.y, 2.5 / zoom) + extension;
      const radius = rectangular ? Math.hypot(halfX, halfY) : Math.max(halfX, halfY);
      const geometry = {
        cx: at.x + dx,
        cy: at.y + dy,
        r: radius + (isSelected ? 3 : 2) / zoom,
        fill: 'none',
        vectorEffect: 'non-scaling-stroke',
      } as const;
      return (
        <Fragment key={key}>
          {conflict && <circle {...geometry} stroke="var(--danger)" strokeWidth={3.5} />}
          <circle
            {...geometry}
            data-pin-role={memberKey}
            stroke={color ?? 'var(--ink-3)'}
            strokeWidth={1.5}
          />
        </Fragment>
      );
    });
  },
  (previous, next) =>
    previous.pads === next.pads &&
    previous.dx === next.dx &&
    previous.dy === next.dy &&
    previous.zoom === next.zoom &&
    sameSelectedPins(previous.selected, next.selected),
);

function PinRoleRings({ snapshot, preview, zoom }: Parameters<LayerSpec['render']>[0]) {
  const selection = useSessionStore((state) => state.selection.items);
  const selectedByComponent = useMemo(() => {
    const selected = new Map<string, Set<string>>();
    for (const { kind, id, componentId } of selection) {
      if (kind !== 'pin' || !componentId) continue;
      const pins = selected.get(componentId) ?? new Set<string>();
      pins.add(pinKey({ c: componentId, p: id }));
      selected.set(componentId, pins);
    }
    return selected;
  }, [selection]);
  const groups = rolePads(snapshot);
  if (!groups.length) return null;
  const { pxPerMm } = snapshot.doc.scale;
  const drag = preview?.owner === SCALE_DRAG_OWNER ? readScaleDrag(preview.data) : null;
  const motion = preview?.owner === 'select' ? (preview.data as TranslatePreviewData) : undefined;
  const movingComponents = new Set(
    motion?.items.filter(({ kind }) => kind === 'component').map(({ id }) => id),
  );
  return (
    <g data-layer="nets.pinRoles" pointerEvents="none" aria-hidden="true">
      {groups.map(({ id, board, styles, pads }) => {
        const delta = movingComponents.has(id) ? motion : undefined;
        const placement = previewBoardScale(board, id, drag, pxPerMm);
        return (
          <ComponentRoleRings
            key={id}
            pads={placement === board ? pads : buildRolePads(placement, styles, pxPerMm)}
            selected={selectedByComponent.get(id)}
            dx={delta?.dx ?? 0}
            dy={delta?.dy ?? 0}
            zoom={zoom}
          />
        );
      })}
    </g>
  );
}

export const pinRolesLayer: LayerSpec = {
  id: 'nets.pinRoles',
  z: 52,
  previewOwners: ['select', SCALE_DRAG_OWNER],
  render: (props) => <PinRoleRings {...props} />,
};
