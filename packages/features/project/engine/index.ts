import type { CommandSpec, EngineModule } from '@pcbk/engine';
import { RenameProjectSchema, SetProjectInfoSchema } from '../contract';
import type { RenameProjectParams, SetProjectInfoParams } from '../contract';

const rename: CommandSpec<RenameProjectParams> = {
  id: 'project.rename',
  title: 'project.rename',
  params: RenameProjectSchema,
  run(doc, params) {
    doc.name = params.name;
  },
};
const setInfo: CommandSpec<SetProjectInfoParams> = {
  id: 'project.setInfo',
  title: 'project.setInfo',
  params: SetProjectInfoSchema,
  run(doc, params) {
    if (params.device !== undefined) doc.device = params.device;
    if (params.problem !== undefined) doc.problem = params.problem;
  },
};
export const projectEngine: EngineModule = {
  id: 'project',
  owns: ['name', 'device', 'problem', 'status', 'mappedAt', 'mappedSnapshot', 'importChecks'],
  commands: [rename, setInfo],
};
