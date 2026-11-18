import type { Snapshot } from '@pcbk/contracts';
import type { Vec2 } from '@pcbk/domain';
import type { ReactNode } from 'react';
import type { LayerSpec, ToolApi, ToolSpec } from '../canvas/tools';
import type { Selection, SelectionItem } from './session-store';
import { isShellShortcut } from './keymap';

export interface SlotSpec {
  id: string;
  order?: number;
  render(): ReactNode;
}

export interface PanelSpec extends SlotSpec {
  title: string;
  summary?(snapshot: Snapshot): string | null;
}

export interface KeySpec {
  id: string;
  key: string;
  shift?: boolean;
  repeat?: boolean;
  run(api: ToolApi, selection: Selection): boolean;
}

export interface ContextMenuItemSpec {
  id: string;
  appliesTo: string[];
  order: number;
  label(snapshot: Snapshot, selection: Selection): string;
  shortcut?: { key: string; shift?: boolean };
  run(api: ToolApi, selection: Selection, at: Vec2): boolean;
}

export interface ContextSectionSpec {
  id: string;
  order: number;
  appliesTo: string[];
  render(props: { selection: Selection }): ReactNode;
}

export interface PinnedSpec {
  id: string;
  order: number;
  useVisible(): boolean;
  render(): ReactNode;
}

export interface SelectionKindSpec {
  kind: SelectionItem['kind'];
  label(snapshot: Snapshot, item: SelectionItem): string | null;
}

export interface UiModule {
  id: string;
  title: string;
  navigatorTabs?: PanelSpec[];
  contextSections?: ContextSectionSpec[];
  contextPinned?: PinnedSpec[];
  selectionKinds?: SelectionKindSpec[];
  topBar?: SlotSpec[];
  bottomBar?: SlotSpec[];
  canvasLayers?: LayerSpec[];
  tools?: ToolSpec[];
  keys?: KeySpec[];
  contextMenu?: ContextMenuItemSpec[];
  onSessionReset?(): void;
}

function copyModule(module: UiModule): UiModule {
  return {
    ...module,
    navigatorTabs: module.navigatorTabs?.map((item) => ({ ...item })),
    contextSections: module.contextSections?.map((item) => ({
      ...item,
      appliesTo: [...item.appliesTo],
    })),
    contextPinned: module.contextPinned?.map((item) => ({ ...item })),
    selectionKinds: module.selectionKinds?.map((item) => ({ ...item })),
    topBar: module.topBar?.map((item) => ({ ...item })),
    bottomBar: module.bottomBar?.map((item) => ({ ...item })),
    canvasLayers: module.canvasLayers?.map((item) => ({ ...item })),
    tools: module.tools?.map((item) => ({ ...item })),
    keys: module.keys?.map((item) => ({ ...item })),
    contextMenu: module.contextMenu?.map((item) => ({
      ...item,
      appliesTo: [...item.appliesTo],
      shortcut: item.shortcut && { ...item.shortcut },
    })),
  };
}

function ordered<T extends { order?: number }>(items: T[]): T[] {
  return items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function uniqueIds(items: { id: string }[], kind: string): void {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (!id.trim()) throw new Error(`Empty ${kind} id`);
    if (seen.has(id)) throw new Error(`Duplicate ${kind} id: ${id}`);
    seen.add(id);
  }
}

export class UiRegistry {
  private readonly registered: UiModule[] = [];

  constructor(modules: UiModule[] = []) {
    for (const module of modules) this.register(module);
  }

  register(module: UiModule): void {
    const candidate = [...this.registered, copyModule(module)];
    uniqueIds(candidate, 'module');
    for (const slot of [
      'navigatorTabs',
      'contextSections',
      'contextPinned',
      'topBar',
      'bottomBar',
      'canvasLayers',
      'contextMenu',
    ] as const) {
      uniqueIds(
        candidate.flatMap<{ id: string }>((item) => item[slot] ?? []),
        slot,
      );
    }
    const tools = [
      { id: 'select', key: undefined },
      { id: 'pan', key: undefined },
      ...candidate.flatMap((item) => item.tools ?? []),
    ];
    uniqueIds(tools, 'tools');
    const keys = candidate.flatMap((item) => item.keys ?? []);
    uniqueIds(keys, 'keys');
    for (const shortcut of candidate.flatMap((item) => [
      ...(item.tools ?? []),
      ...(item.keys ?? []),
    ])) {
      if (
        shortcut.key !== undefined &&
        isShellShortcut(shortcut.key, 'shift' in shortcut && shortcut.shift === true)
      ) {
        throw new Error(`Reserved shell keyboard shortcut: ${shortcut.key}`);
      }
    }
    uniqueIds(
      [
        ...tools.flatMap(({ key }) => (key === undefined ? [] : [{ id: key.toLowerCase() }])),
        ...keys.map(({ key, shift }) => ({ id: `${shift ? 'Shift+' : ''}${key.toLowerCase()}` })),
      ],
      'keyboard shortcut',
    );
    this.registered.push(candidate[candidate.length - 1]!);
  }

  modules(): UiModule[] {
    return this.registered.map(copyModule);
  }
  navigatorTabs(): PanelSpec[] {
    return ordered(this.modules().flatMap((module) => module.navigatorTabs ?? []));
  }
  contextSections(selection: Selection): ContextSectionSpec[] {
    if (selection.items.length === 0) return [];
    return ordered(
      this.modules()
        .flatMap((module) => module.contextSections ?? [])
        .filter((section) => selection.items.every(({ kind }) => section.appliesTo.includes(kind))),
    );
  }
  contextPinned(): PinnedSpec[] {
    return ordered(this.modules().flatMap((module) => module.contextPinned ?? []));
  }
  contextMenu(kind: string): ContextMenuItemSpec[] {
    return ordered(
      this.modules()
        .flatMap((module) => module.contextMenu ?? [])
        .filter((item) => item.appliesTo.includes(kind)),
    );
  }
  selectionLabel(snapshot: Snapshot, selection: Selection): string | null {
    const [item] = selection.items;
    if (selection.items.length !== 1 || !item) return null;
    for (const module of this.registered) {
      for (const spec of module.selectionKinds ?? []) {
        if (spec.kind !== item.kind) continue;
        const label = spec.label(snapshot, item);
        if (label !== null) return label;
      }
    }
    return null;
  }
  topBar(): SlotSpec[] {
    return ordered(this.modules().flatMap((module) => module.topBar ?? []));
  }
  bottomBar(): SlotSpec[] {
    return ordered(this.modules().flatMap((module) => module.bottomBar ?? []));
  }
  canvasLayers(): LayerSpec[] {
    return this.modules()
      .flatMap((module) => module.canvasLayers ?? [])
      .sort((a, b) => a.z - b.z);
  }
  tools(): ToolSpec[] {
    return this.modules().flatMap((module) => module.tools ?? []);
  }
  keys(): KeySpec[] {
    return this.modules().flatMap((module) => module.keys ?? []);
  }
  resetSession(): void {
    for (const module of this.registered) module.onSessionReset?.();
  }
}
