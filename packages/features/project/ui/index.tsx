import { Button, et } from '@pcbk/ui';
import type { UiModule } from '@pcbk/ui';
export function createProjectUi(actions: { onHome(): void }): UiModule {
  return {
    id: 'project',
    title: et.appName,
    topBar: [
      {
        id: 'project.home',
        order: 0,
        render: () => <Button onClick={actions.onHome}>{et.project.returnHome}</Button>,
      },
    ],
  };
}
