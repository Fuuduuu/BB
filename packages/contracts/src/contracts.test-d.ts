import { expectTypeOf } from 'vitest';
import type { BoardDoc, DocKey } from '@pcbk/domain';
import type { ZodIssue } from 'zod';
import { err, ok } from './index';
import type {
  BackupInfo,
  CommandId,
  CommandOk,
  CopyReq,
  CreateReq,
  DeepReadonly,
  Derived,
  DocumentEngine,
  DomainEvent,
  EngineError,
  OpenReq,
  ParamsOf,
  ProjectInfo,
  ProjectService,
  RestoreReq,
  Result,
  SaveStatus,
  Snapshot,
  StorageReason,
  Unsubscribe,
  ViewState,
} from './index';

// A feature extends the public command contract without an implementation import.
declare module '@pcbk/contracts' {
  interface CommandMap {
    'contract-test.set': { value: string };
  }
}

declare const snapshot: Snapshot;
declare const engine: DocumentEngine;
declare const projects: ProjectService;
declare const collections: DeepReadonly<{
  map: Map<{ id: string }, { count: number }>;
  set: Set<{ id: string }>;
}>;

expectTypeOf<Snapshot['doc']>().toEqualTypeOf<DeepReadonly<BoardDoc>>();
expectTypeOf<Snapshot['derived']>().toEqualTypeOf<DeepReadonly<Derived>>();
expectTypeOf<Snapshot['history']>().toEqualTypeOf<
  DeepReadonly<{ canUndo: boolean; canRedo: boolean }>
>();
expectTypeOf<Snapshot['doc']['components'][number]['pins']>().toMatchTypeOf<readonly unknown[]>();
expectTypeOf(collections.map).toEqualTypeOf<
  ReadonlyMap<{ readonly id: string }, { readonly count: number }>
>();
expectTypeOf(collections.set).toEqualTypeOf<ReadonlySet<{ readonly id: string }>>();

// @ts-expect-error readonly maps do not expose set
collections.map.set({ id: 'pin' }, { count: 1 });
// @ts-expect-error readonly sets do not expose add
collections.set.add({ id: 'pin' });

// @ts-expect-error snapshot metadata is readonly
snapshot.rev = 2;
// @ts-expect-error history availability is owned by the engine
snapshot.history.canUndo = false;
// @ts-expect-error the entire history reference is readonly
snapshot.history = { canUndo: true, canRedo: false };
// @ts-expect-error the entire document reference is readonly
snapshot.doc = {} as BoardDoc;
// @ts-expect-error document collections cannot be replaced
snapshot.doc.components = [];
// @ts-expect-error document arrays cannot be extended
snapshot.doc.components.push({} as never);
// @ts-expect-error nested pin arrays cannot be extended
snapshot.doc.components[0]!.pins.push({} as never);
// @ts-expect-error nested pin objects are readonly
snapshot.doc.components[0]!.pins[0]!.name = 'VCC';
// @ts-expect-error optional placements contain readonly dictionaries
snapshot.doc.components[0]!.board!.params['pitch'] = 1.27;
// @ts-expect-error tuple members are readonly too
snapshot.doc.photos[0]!.toBoard![0] = 2;
// @ts-expect-error derived arrays cannot be extended
snapshot.derived.unplacedBoard.push('cmp_test');
// @ts-expect-error derived properties cannot be replaced
snapshot.derived.unplacedSchematic = [];

expectTypeOf<DocumentEngine['execute']>().returns.toEqualTypeOf<Result<CommandOk, EngineError>>();
expectTypeOf<DocumentEngine['undo']>().returns.toEqualTypeOf<Result<CommandOk, EngineError>>();
expectTypeOf<DocumentEngine['redo']>().returns.toEqualTypeOf<Result<CommandOk, EngineError>>();
expectTypeOf<DocumentEngine['snapshot']>().returns.toEqualTypeOf<Snapshot>();
expectTypeOf<DocumentEngine['subscribe']>().returns.toEqualTypeOf<Unsubscribe>();
expectTypeOf<DocumentEngine['events']>().returns.toEqualTypeOf<Unsubscribe>();
expectTypeOf<ParamsOf<'items.delete'>>().toEqualTypeOf<{ ids: string[] }>();
expectTypeOf<ParamsOf<'contract-test.set'>>().toEqualTypeOf<{ value: string }>();
expectTypeOf<CommandId>().toMatchTypeOf<`${string}.${string}`>();
engine.execute('items.delete', { ids: ['cmp_test'] }, { requestId: 'request_1' });
engine.execute('contract-test.set', { value: 'New value' });
// @ts-expect-error known commands reject wrong parameter types
engine.execute('items.delete', { ids: 42 });
// @ts-expect-error parameter shapes cannot be borrowed from another command
engine.execute('items.delete', { value: 'wrong command' });
// @ts-expect-error augmented commands retain their own parameter type
engine.execute('contract-test.set', { value: 42 });
// @ts-expect-error unregistered commands are not part of the public typed API
engine.execute('unregistered.command', {});

engine.subscribe((value) => expectTypeOf(value).toEqualTypeOf<Snapshot>());
engine.events((event) => {
  expectTypeOf(event).toEqualTypeOf<DomainEvent>();
  expectTypeOf(event.sessionId).toEqualTypeOf<string>();
  expectTypeOf(event.rev).toEqualTypeOf<number>();
  expectTypeOf(event.payload).toBeUnknown();
});

expectTypeOf<EngineError>().toEqualTypeOf<
  | { code: 'validation'; issues: ZodIssue[] }
  | { code: 'internal'; message: string }
  | { code: 'ownership'; field: DocKey; command: CommandId }
  | { code: 'not_found'; id: string }
  | { code: 'read_only' }
  | { code: 'stale_rev'; expected: number; actual: number }
  | { code: 'stale_session' }
  | { code: 'storage'; reason: StorageReason }
>();
expectTypeOf<StorageReason>().toEqualTypeOf<
  | 'disk_full'
  | 'read_only'
  | 'missing'
  | 'locked'
  | 'exists'
  | 'not_project'
  | 'too_new'
  | 'stale_rev'
  | 'unknown'
>();

const success: Result<number, EngineError> = ok(42);
const failure: Result<number, EngineError> = err<EngineError>({ code: 'read_only' });
expectTypeOf(ok<number>(42)).toEqualTypeOf<{ ok: true; value: number }>();
expectTypeOf(err<string>('problem')).toEqualTypeOf<{ ok: false; error: string }>();
expectTypeOf(success).toMatchTypeOf<Result<number, EngineError>>();
expectTypeOf(failure).toMatchTypeOf<Result<number, EngineError>>();
// @ts-expect-error a failure branch has no successful value
void failure.value;

const create: CreateReq = {
  name: 'Plaat',
  device: 'Seade',
  problem: 'Ei käivitu',
  path: 'Plaat.pcbk',
};
const open: OpenReq = { path: 'Plaat.pcbk' };
const copy: CopyReq = { dest: 'Koopia.pcbk', identity: 'new' };
const restore: RestoreReq = { backup: 'backup.pcbk', dest: 'Taastatud.pcbk' };
const view: ViewState = {
  navigatorWidth: 260,
  navigatorTab: 'components',
  contextWidth: 340,
  contextOpen: true,
};
expectTypeOf<ProjectInfo['view']>().toEqualTypeOf<ViewState | null>();
expectTypeOf<ProjectInfo['fileId']>().toEqualTypeOf<string>();
expectTypeOf<BackupInfo['fileId']>().toEqualTypeOf<string | undefined>();
declare const projectInfo: ProjectInfo;
// @ts-expect-error physical file identity is owned by storage
projectInfo.fileId = 'replacement';
expectTypeOf(projects.create(create)).toEqualTypeOf<Promise<Result<ProjectInfo, EngineError>>>();
expectTypeOf(projects.open(open)).toEqualTypeOf<Promise<Result<ProjectInfo, EngineError>>>();
expectTypeOf(projects.close()).toEqualTypeOf<Promise<Result<void, EngineError>>>();
expectTypeOf(projects.flush()).toEqualTypeOf<Promise<Result<void, EngineError>>>();
expectTypeOf(projects.copy(copy)).toEqualTypeOf<
  Promise<Result<ProjectInfo & { fromMemory: boolean }, EngineError>>
>();
expectTypeOf(projects.backups()).toEqualTypeOf<Promise<Result<BackupInfo[], EngineError>>>();
expectTypeOf(projects.restore(restore)).toEqualTypeOf<Promise<Result<ProjectInfo, EngineError>>>();
expectTypeOf(projects.saveView(view)).toBeVoid();
expectTypeOf<ProjectService['status']>().returns.toEqualTypeOf<Unsubscribe>();
projects.status((status) => {
  expectTypeOf(status).toEqualTypeOf<SaveStatus & { sessionId: string }>();
  if (status.state === 'error') expectTypeOf(status.reason).toEqualTypeOf<StorageReason>();
  if (status.state === 'saved') {
    expectTypeOf(status.rev).toEqualTypeOf<number>();
    expectTypeOf(status.at).toEqualTypeOf<string>();
  }
});
// @ts-expect-error copy identity must be explicitly chosen
projects.copy({ dest: 'Koopia.pcbk' });
// @ts-expect-error saved status cannot omit its revision
const invalidStatus: SaveStatus = { state: 'saved', at: '2026-11-07T10:00:00Z' };
void invalidStatus;
