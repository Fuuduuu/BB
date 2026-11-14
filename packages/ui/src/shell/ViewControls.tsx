import { useSnapshot } from '@pcbk/client';
import { useCursorStore } from '../canvas/cursor-store';
import { Button } from '../kit/Button';
import { et } from './i18n/et';
import { useViewStore } from './view-store';

function CursorReadout() {
  const world = useCursorStore((state) => state.world);
  const pxPerMm = useSnapshot((snapshot) => snapshot.doc.scale.pxPerMm);
  return (
    <span className="pcbk-cursor-readout">
      {et.shell.cursor(world ? { x: world.x / pxPerMm, y: world.y / pxPerMm } : null)}
    </span>
  );
}
export function ViewControls() {
  const zoom = useViewStore((state) => state.boardView.zoom);
  return (
    <div className="pcbk-view-controls">
      <Button onClick={() => useViewStore.getState().requestZoom(1 / 1.25)}>
        {et.shell.zoomOut}
      </Button>
      <span>{et.shell.zoomPercent(zoom)}</span>
      <Button onClick={() => useViewStore.getState().requestZoom(1.25)}>{et.shell.zoomIn}</Button>
      <Button onClick={() => useViewStore.getState().requestFit()}>{et.shell.fit}</Button>
      <CursorReadout />
    </div>
  );
}
