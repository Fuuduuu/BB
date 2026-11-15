import { createRoot } from 'react-dom/client';
import { EngineProvider } from '@pcbk/client';
import { uiFeatures } from '@pcbk/features/ui';
import { engineFeatures } from '@pcbk/features/engine';
import { assertModulePairs, UI_ONLY_MODULES } from '@pcbk/features/composition';
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
      validateModules={(modules) =>
        assertModulePairs(
          engineFeatures.map(({ id }) => id),
          modules.map(({ id }) => id),
          UI_ONLY_MODULES,
        )
      }
      addPhoto={(file) => addPhoto(file, runtime)}
    />
  </EngineProvider>,
);

if (import.meta.env.DEV && import.meta.env.VITE_PCBK_PERF === '1')
  void import('./perf/probe').then((m) => m.runPerfProbe(runtime));

if (import.meta.env.DEV && import.meta.env.VITE_PCBK_PNG_PROBE === '1')
  void import('./perf/png-probe').then((m) => m.runPngProbe(runtime));
