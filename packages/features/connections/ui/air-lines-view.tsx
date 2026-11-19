import { Button, useViewStore } from '@pcbk/ui';
import { connectionsEt } from './i18n/et';

function airLinesVisible(modules: ReturnType<typeof useViewStore.getState>['modules']): boolean {
  const view = modules.connections;
  return !(view && typeof view === 'object' && 'airLines' in view && view.airLines === false);
}

export const airLineHitsEnabled = () => airLinesVisible(useViewStore.getState().modules);

export function AirLinesToggle() {
  const visible = useViewStore((store) => airLinesVisible(store.modules));
  return (
    <Button
      variant="ghost"
      aria-pressed={visible}
      onClick={() => useViewStore.getState().setModuleView('connections', { airLines: !visible })}
    >
      {connectionsEt.airLines}
    </Button>
  );
}

export function useAirLinesVisible(): boolean {
  return useViewStore((store) => airLinesVisible(store.modules));
}
