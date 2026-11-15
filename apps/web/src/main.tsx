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
import { createWebHost } from './web-host';
const runtime = createRuntime();
const host = createWebHost(runtime.repo);
createRoot(document.getElementById('root')!).render(
  <EngineProvider engine={runtime.engine} projects={runtime.projects}>
    <Workbench
      host={host}
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
