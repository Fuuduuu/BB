import type { IdGen } from '@pcbk/contracts';
import { et } from '@pcbk/ui';
import type { UiModule } from '@pcbk/ui';
import { ComponentList } from './ComponentList';
import { ComponentDetails } from './ComponentDetails';
import './components.css';

export function createComponentsUi(ids: IdGen): UiModule {
  return {
    id: 'components',
    title: et.component.title,
    navigatorTabs: [
      { id: 'components', title: et.component.title, render: () => <ComponentList ids={ids} /> },
    ],
    contextSections: [
      {
        id: 'component',
        order: 0,
        appliesTo: ['component', 'pin'],
        render: ({ selection }) => {
          const id =
            selection.kind === 'component'
              ? selection.id
              : selection.kind === 'pin'
                ? selection.componentId
                : null;
          return id ? <ComponentDetails key={id} id={id} ids={ids} /> : null;
        },
      },
    ],
  };
}
