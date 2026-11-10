import { useEffect } from 'react';
import { useEngine } from '@pcbk/client';
import type { IdGen } from '@pcbk/contracts';
import { useSessionStore, useViewStore } from '@pcbk/ui';
import type { UiModule } from '@pcbk/ui';
import { contactFromSelection } from './contacts';
import { measureEt } from './i18n/et';
import { READING_LABELS_LAYER } from './layers/ReadingLabels';
import { MeasureBlock } from './MeasureBlock';
import { MeasurementList } from './MeasurementList';
import { useMeasureStore } from './measure-store';
import { pickRefToolSpec } from './PickRefTool';

function useMeasureVisible(): boolean {
  const engine = useEngine();
  useEffect(
    () =>
      useSessionStore.subscribe((current, previous) => {
        if (current.selection === previous.selection) return;
        const snapshot = engine.snapshot();
        if (current.sessionId !== snapshot.sessionId) return;
        const at = contactFromSelection(snapshot, current.selection);
        if (at) useMeasureStore.getState().setMeasureAt(at);
      }),
    [engine],
  );
  return useMeasureStore((state) => state.measureAt !== null);
}

export function createMeasurementsUi(ids: IdGen): UiModule {
  return {
    id: 'measurements',
    title: measureEt.list.title,
    navigatorTabs: [
      {
        id: 'measurements',
        title: measureEt.list.title,
        order: 3,
        count: (snapshot) => snapshot.doc.measurements.length,
        render: () => <MeasurementList />,
      },
    ],
    contextPinned: [
      {
        id: 'measure',
        order: 0,
        useVisible: useMeasureVisible,
        render: () => <MeasureBlock ids={ids} suggestions={[]} />,
      },
    ],
    tools: [pickRefToolSpec()],
    keys: [
      {
        id: 'measurements.focus',
        key: 'M',
        run: (api, selection) => {
          const store = useMeasureStore.getState();
          if (!store.measureAt) {
            const at = contactFromSelection(api.snapshot(), selection);
            if (!at) return false;
            store.setMeasureAt(at);
          }
          useViewStore.getState().setContextOpen(true);
          store.requestFocus();
          return true;
        },
      },
    ],
    canvasLayers: [READING_LABELS_LAYER],
    onSessionReset: () => useMeasureStore.getState().reset(),
  };
}
