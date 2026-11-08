import { createRoot } from 'react-dom/client';
import { EngineProvider } from '@pcbk/client';
import '@pcbk/ui/styles.css';
import '@pcbk/ui/fonts';
import './web.css';
import { App } from './App';
import { createRuntime } from './runtime';
const runtime = createRuntime();
createRoot(document.getElementById('root')!).render(
  <EngineProvider engine={runtime.engine} projects={runtime.projects}>
    <App runtime={runtime} />
  </EngineProvider>,
);
