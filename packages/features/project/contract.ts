import { z } from 'zod';

export const RenameProjectSchema = z.strictObject({ name: z.string().trim().min(1).max(120) });
export const SetProjectInfoSchema = z.strictObject({
  device: z.string().optional(),
  problem: z.string().optional(),
});
export type RenameProjectParams = z.infer<typeof RenameProjectSchema>;
export type SetProjectInfoParams = z.infer<typeof SetProjectInfoSchema>;

declare module '@pcbk/contracts' {
  interface CommandMap {
    'project.rename': RenameProjectParams;
    'project.setInfo': SetProjectInfoParams;
  }
}
