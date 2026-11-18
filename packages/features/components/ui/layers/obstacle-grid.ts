export interface ScreenBox {
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

export class ObstacleGrid {
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
