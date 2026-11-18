import type { Snapshot } from '@pcbk/contracts';
import type { BoardPlacement, Component, Vec2 } from '@pcbk/domain';
import { footprintGeometry } from '@pcbk/domain/footprints';
import { boardPads, bodyOutline } from '@pcbk/domain/geometry';
import { monoLabelHalf, sceneToScreenVector, screenToSceneVector } from '@pcbk/ui';
import type { LabelObstacle, SceneTransform } from '@pcbk/ui';

export const LABEL_DRAG_OWNER = 'components.label';

type LabelComponent = Pick<Component, 'id' | 'ref' | 'value' | 'identified'> & {
  board: BoardPlacement;
};

export interface ComponentLabelBox {
  at: Vec2;
  offset: Vec2;
  textSize: number;
  valueAt: Vec2;
  valueY: number;
  box: LabelObstacle;
}

interface ScreenBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function overlaps(a: ScreenBox, b: ScreenBox): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function someCell<T>(
  cells: Map<number, T>,
  start: number,
  end: number,
  matches: (cell: T) => boolean,
): boolean {
  if (Number.isSafeInteger(start) && Number.isSafeInteger(end) && end - start + 1 <= cells.size) {
    for (let index = start; index <= end; index++) {
      const cell = cells.get(index);
      if (cell !== undefined && matches(cell)) return true;
    }
  } else {
    for (const [index, cell] of cells) {
      if (index >= start && index <= end && matches(cell)) return true;
    }
  }
  return false;
}

class ObstacleGrid {
  private readonly levels = new Map<number, Map<number, Map<number, ScreenBox[]>>>();

  constructor(private readonly cellSize: number) {}

  add(box: ScreenBox): void {
    const largestCoordinate = Math.max(
      Math.abs(box.left),
      Math.abs(box.right),
      Math.abs(box.top),
      Math.abs(box.bottom),
    );
    // Coarser cells keep a large obstacle within four cells and cell indices safe to increment.
    const extent = Math.max(
      box.right - box.left,
      box.bottom - box.top,
      largestCoordinate / 2 ** 24,
    );
    const size = this.cellSize * 2 ** Math.max(0, Math.ceil(Math.log2(extent / this.cellSize)));
    if (!Number.isFinite(size)) return;
    let rows = this.levels.get(size);
    if (!rows) this.levels.set(size, (rows = new Map()));
    for (let row = Math.floor(box.top / size); row <= Math.floor(box.bottom / size); row++) {
      let columns = rows.get(row);
      if (!columns) rows.set(row, (columns = new Map()));
      for (
        let column = Math.floor(box.left / size);
        column <= Math.floor(box.right / size);
        column++
      ) {
        const cell = columns.get(column);
        if (cell) cell.push(box);
        else columns.set(column, [box]);
      }
    }
  }

  overlaps(box: ScreenBox): boolean {
    for (const [size, rows] of this.levels) {
      const left = Math.floor(box.left / size);
      const right = Math.floor(box.right / size);
      const top = Math.floor(box.top / size);
      const bottom = Math.floor(box.bottom / size);
      if (
        someCell(rows, top, bottom, (columns) =>
          someCell(columns, left, right, (cell) =>
            cell.some((obstacle) => overlaps(box, obstacle)),
          ),
        )
      )
        return true;
    }
    return false;
  }
}

function expand(bounds: ScreenBox, other: ScreenBox) {
  bounds.left = Math.min(bounds.left, other.left);
  bounds.right = Math.max(bounds.right, other.right);
  bounds.top = Math.min(bounds.top, other.top);
  bounds.bottom = Math.max(bounds.bottom, other.bottom);
}

type PadShape = ReturnType<typeof boardPads>[number]['shape'];

function padExtent(
  shape: PadShape,
  halfX: number,
  halfY: number,
  axisX: number,
  axisY: number,
): number {
  if (shape === 'circle') {
    return halfX === halfY ? halfX : Math.hypot(axisX * halfX, axisY * halfY);
  }
  if (shape === 'oval') {
    const radius = Math.min(halfX, halfY);
    // A rounded pad is a segment along its long axis with a circular radius.
    return radius + Math.abs(axisX) * (halfX - radius) + Math.abs(axisY) * (halfY - radius);
  }
  return Math.abs(axisX) * halfX + Math.abs(axisY) * halfY;
}

function componentGeometry(
  board: BoardPlacement,
  pxPerMm: number,
  transform: SceneTransform,
  zoom: number,
  displayedPins?: ReadonlySet<string>,
) {
  const center = sceneToScreenVector(transform, board.center);
  const bounds = { left: center.x, right: center.x, top: center.y, bottom: center.y };
  const up = screenToSceneVector(transform, { x: 0, y: -1 });
  const project = ({ x, y }: Vec2) => (x - board.center.x) * up.x + (y - board.center.y) * up.y;
  const outline = bodyOutline(board, pxPerMm);
  let topDistance = 0;
  const obstacles: ScreenBox[] = [];

  if (outline.length > 0) {
    const body = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    for (const corner of outline) {
      topDistance = Math.max(topDistance, project(corner));
      const { x, y } = sceneToScreenVector(transform, corner);
      expand(body, { left: x, right: x, top: y, bottom: y });
    }
    expand(bounds, body);
    obstacles.push(body);
  }

  // Include nominal pads in the legacy top clearance, including on older documents with missing pins.
  const footprint = footprintGeometry(board.footprint, board.params);
  const pinIds = [
    ...(footprint?.pads.map(({ id }) => board.padMap?.[id] ?? id) ?? []),
    ...Object.keys(board.customPads),
  ];
  const minHalf = 2.5 / zoom;
  for (const { at, halfPx, angleDeg, shape, pinId } of boardPads(board, pinIds, pxPerMm)) {
    const halfX = Math.max(halfPx.x, minHalf);
    const halfY = Math.max(halfPx.y, minHalf);
    const radians = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const upAlongX = up.x * cos + up.y * sin;
    const upAlongY = -up.x * sin + up.y * cos;
    const legacyShape = shape === 'oval' ? 'rect' : shape;
    const legacyHeight = padExtent(legacyShape, halfX, halfY, upAlongX, upAlongY);
    topDistance = Math.max(topDistance, project(at) + legacyHeight);

    if (!displayedPins?.has(pinId)) continue;
    const axisX = sceneToScreenVector(transform, { x: cos, y: sin });
    const axisY = sceneToScreenVector(transform, { x: -sin, y: cos });
    const pad = sceneToScreenVector(transform, at);
    const width = padExtent(shape, halfX, halfY, axisX.x, axisY.x);
    const height = padExtent(shape, halfX, halfY, axisX.y, axisY.y);
    const box = {
      left: pad.x - width,
      right: pad.x + width,
      top: pad.y - height,
      bottom: pad.y + height,
    };
    expand(bounds, box);
    obstacles.push(box);
  }

  return { bounds, center, obstacles, topDistance, up };
}

function defaultLabelOffset(
  { topDistance, up }: ReturnType<typeof componentGeometry>,
  pxPerMm: number,
  hasValue: boolean,
  zoom: number,
): Vec2 {
  const valueOffset = hasValue ? 1.2 * 1.6 * pxPerMm : 0;
  const textHalfHeight = monoLabelHalf('', 1.6 * pxPerMm, zoom).y;
  // Area hits extend by six screen pixels. Leave the body-center drag point outside the label hit.
  const distance = Math.max(
    topDistance + valueOffset + textHalfHeight + 1 / zoom,
    valueOffset + textHalfHeight + 7 / zoom,
  );
  return { x: up.x * distance, y: up.y * distance };
}

function labelLayout(
  board: BoardPlacement,
  offset: Vec2,
  textSize: number,
  transform: SceneTransform,
) {
  const at = { x: board.center.x + offset.x, y: board.center.y + offset.y };
  const valueOffset = screenToSceneVector(transform, { x: 0, y: 1.2 * textSize });
  const valueAt = { x: at.x + valueOffset.x, y: at.y + valueOffset.y };
  return { at, offset, textSize, valueAt, valueY: valueAt.y };
}

export function componentLabelLayout(
  board: BoardPlacement,
  pxPerMm: number,
  hasValue = false,
  transform: SceneTransform = 'none',
  zoom = 1,
) {
  const offset =
    board.labelOffset ??
    defaultLabelOffset(componentGeometry(board, pxPerMm, transform, zoom), pxPerMm, hasValue, zoom);
  return labelLayout(board, offset, 1.6 * pxPerMm, transform);
}

function labelExtents(
  { ref, value, identified }: Pick<LabelComponent, 'ref' | 'value' | 'identified'>,
  textSize: number,
  zoom: number,
) {
  const refHalf = monoLabelHalf(`${ref}${identified ? '' : ' ?'}`, textSize, zoom);
  const valueHalf = value ? monoLabelHalf(value, textSize, zoom) : null;
  return {
    halfWidth: Math.max(refHalf.x, valueHalf?.x ?? 0),
    top: -refHalf.y,
    bottom: Math.max(refHalf.y, valueHalf ? 1.2 * textSize + valueHalf.y : 0),
  };
}

function labelBox(
  id: string,
  layout: ReturnType<typeof labelLayout>,
  { top, bottom, halfWidth }: ReturnType<typeof labelExtents>,
  transform: SceneTransform,
): ComponentLabelBox {
  const { at } = layout;
  const centerOffset = screenToSceneVector(transform, { x: 0, y: (top + bottom) / 2 });
  return {
    ...layout,
    box: {
      owner: LABEL_DRAG_OWNER,
      componentId: id,
      center: { x: at.x + centerOffset.x, y: at.y + centerOffset.y },
      half: { x: halfWidth, y: (bottom - top) / 2 },
    },
  };
}

export function componentLabelBox(
  component: LabelComponent,
  pxPerMm: number,
  zoom: number,
  transform: SceneTransform,
): ComponentLabelBox {
  const layout = componentLabelLayout(
    component.board,
    pxPerMm,
    Boolean(component.value),
    transform,
    zoom,
  );
  return labelBox(component.id, layout, labelExtents(component, layout.textSize, zoom), transform);
}

export function isComponentLabelVisible(textSize: number, zoom: number): boolean {
  return textSize * zoom >= 8;
}

function chooseOffset(
  above: Vec2,
  { bounds, center }: ReturnType<typeof componentGeometry>,
  { top, bottom, halfWidth }: ReturnType<typeof labelExtents>,
  grid: ObstacleGrid,
  zoom: number,
  transform: SceneTransform,
): Vec2 {
  const margin = 1 / zoom;
  const centerGap = 7 / zoom;
  const middle = -(top + bottom) / 2;
  const topOffset = sceneToScreenVector(transform, above);
  const candidates = [
    topOffset,
    { x: 0, y: Math.max(bounds.bottom - center.y + margin, centerGap) - top },
    { x: Math.max(bounds.right - center.x + margin, centerGap) + halfWidth, y: middle },
    { x: -(Math.max(center.x - bounds.left + margin, centerGap) + halfWidth), y: middle },
  ];
  for (const candidate of candidates) {
    const x = center.x + candidate.x;
    const y = center.y + candidate.y;
    if (
      !grid.overlaps({
        left: x - halfWidth,
        right: x + halfWidth,
        top: y + top,
        bottom: y + bottom,
      })
    ) {
      return candidate === topOffset ? above : screenToSceneVector(transform, candidate);
    }
  }
  return above;
}

type SourceComponent = Snapshot['doc']['components'][number];
type PlacementGeometry = { pxPerMm: number; zoom: number; transform: SceneTransform };
type ComponentGeometry = PlacementGeometry & {
  geometry: ReturnType<typeof componentGeometry>;
  label?: ComponentLabelBox;
};
type PlacementResult = PlacementGeometry & {
  placements: ReadonlyMap<string, ComponentLabelBox>;
};

const CACHE_ENTRIES = 8;
const placementCache = new WeakMap<Snapshot['doc']['components'], PlacementResult[]>();
const componentCache = new WeakMap<SourceComponent, ComponentGeometry>();

function sameGeometry(a: PlacementGeometry, b: PlacementGeometry): boolean {
  return a.pxPerMm === b.pxPerMm && a.zoom === b.zoom && a.transform === b.transform;
}

export function componentLabelPlacements(
  { components, scale: { pxPerMm } }: Snapshot['doc'],
  zoom: number,
  transform: SceneTransform,
): ReadonlyMap<string, ComponentLabelBox> {
  const key = { pxPerMm, zoom, transform };
  let cached = placementCache.get(components);
  if (!cached) placementCache.set(components, (cached = []));
  const match = cached.find((entry) => sameGeometry(entry, key));
  if (match) return match.placements;

  const textSize = 1.6 * pxPerMm;
  const grid = new ObstacleGrid(64 / zoom);
  const placed = components.flatMap((component) => {
    const { board } = component;
    if (!board) return [];
    let entry = componentCache.get(component);
    if (!entry || !sameGeometry(entry, key)) {
      const pins = new Set(component.pins.map(({ id }) => id));
      entry = { ...key, geometry: componentGeometry(board, pxPerMm, transform, zoom, pins) };
      componentCache.set(component, entry);
    }
    for (const obstacle of entry.geometry.obstacles) grid.add(obstacle);
    return [{ component, board, entry }];
  });
  const placements = new Map<string, ComponentLabelBox>();
  for (const { component, board, entry } of placed) {
    const { geometry } = entry;
    const { id, value } = component;
    const extents = labelExtents(component, textSize, zoom);
    const offset =
      board.labelOffset ??
      chooseOffset(
        defaultLabelOffset(geometry, pxPerMm, Boolean(value), zoom),
        geometry,
        extents,
        grid,
        zoom,
        transform,
      );
    if (entry.label?.offset.x !== offset.x || entry.label.offset.y !== offset.y) {
      entry.label = labelBox(
        id,
        labelLayout(board, offset, textSize, transform),
        extents,
        transform,
      );
    }
    placements.set(id, entry.label);
  }
  cached.push({ ...key, placements });
  if (cached.length > CACHE_ENTRIES) cached.shift();
  return placements;
}
