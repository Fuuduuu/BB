import { expectTypeOf } from 'vitest';
import type { DocumentEngine, ProjectService, SaveStatus } from '@pcbk/contracts';
import { useEngine, useProjects, useSaveStatus, useSnapshot } from './index';

expectTypeOf(useEngine()).toEqualTypeOf<DocumentEngine>();
expectTypeOf(useProjects()).toEqualTypeOf<ProjectService>();
expectTypeOf(useSaveStatus()).toEqualTypeOf<SaveStatus>();
expectTypeOf(useSnapshot((snapshot) => snapshot.rev)).toEqualTypeOf<number>();
const components = useSnapshot((snapshot) => snapshot.doc.components);
// @ts-expect-error the client preserves the document's readonly collection
components.push({} as never);
// @ts-expect-error nested properties remain readonly through the hook's selector
components[0]!.pins[0]!.uid = 'pin_changed';
