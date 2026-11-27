import { useSnapshot } from '@pcbk/client';
import { useCursorStore } from '../canvas/cursor-store';
import { Button } from '../kit/Button';
import { et } from './i18n/et';
import { useViewStore } from './view-store';

const cssPixelsPerMm = 96 / 25.4;

function CursorReadout() {
  const world = useCursorStore((state) => state.world);
  const pxPerMm = useSnapshot((snapshot) => snapshot.doc.scale.pxPerMm);
  const activeView = useViewStore((state) => state.activeView);
  const point =
    world && activeView === 'board' ? { x: world.x / pxPerMm, y: world.y / pxPerMm } : world;
  return <span className="pcbk-cursor-readout">{et.shell.cursor(point)}</span>;
}
export function ViewControls() {
  const zoom = useViewStore((state) =>
    state.activeView === 'schematic'
      ? (state.schematicView?.zoom ?? 1) / cssPixelsPerMm
      : state.boardView.zoom,
  );
  return (
    <div className="pcbk-view-controls">
      <Button
        aria-label={et.shell.zoomOut}
        title={et.shell.zoomOut}
        onClick={() => useViewStore.getState().requestZoom(1 / 1.25)}
      >
        −
      </Button>
      <span>{et.shell.zoomPercent(zoom)}</span>
      <Button
        aria-label={et.shell.zoomIn}
        title={et.shell.zoomIn}
        onClick={() => useViewStore.getState().requestZoom(1.25)}
      >
        +
      </Button>
      <Button onClick={() => useViewStore.getState().requestFit()}>{et.shell.fit}</Button>
      <CursorReadout />
    </div>
  );
}
