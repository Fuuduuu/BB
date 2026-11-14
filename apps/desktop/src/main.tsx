import { createRoot } from 'react-dom/client';
import { EngineProvider } from '@pcbk/client';
import { uiFeatures } from '@pcbk/features/ui';
import { addPhoto } from '@pcbk/features/photo/ui';
import { Workbench } from '@pcbk/ui';
import '@pcbk/ui/styles.css';
import '@pcbk/ui/fonts';
import { createRuntime } from './runtime';

const runtime = createRuntime();
createRoot(document.getElementById('root')!).render(
  <EngineProvider engine={runtime.engine} projects={runtime.projects}>
    <Workbench
      host={runtime.appHost}
      uiModules={(onHome) => uiFeatures(runtime.ids, onHome)}
      addPhoto={(file) => addPhoto(file, runtime)}
    />
  </EngineProvider>,
);

if (import.meta.env.DEV && import.meta.env.VITE_PCBK_PERF === '1')
  void import('./perf/probe').then((m) => m.runPerfProbe(runtime));
