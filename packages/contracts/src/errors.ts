import type { DocKey } from '@pcbk/domain';
import type { ZodIssue } from 'zod';
import type { CommandId } from './document-engine';

export type StorageReason =
  'disk_full' | 'read_only' | 'missing' | 'locked' | 'not_project' | 'too_new' | 'unknown';

export type EngineError =
  | { code: 'validation'; issues: ZodIssue[] }
  | { code: 'ownership'; field: DocKey; command: CommandId }
  | { code: 'not_found'; id: string }
  | { code: 'read_only' }
  | { code: 'stale_rev'; expected: number; actual: number }
  | { code: 'stale_session' }
  | { code: 'storage'; reason: StorageReason };
