import type { ReactNode } from 'react';
import type { Selection, SelectionKind } from './session-store';

export interface SlotSpec {
  id: string;
  order?: number;
  render(): ReactNode;
}

export interface PanelSpec extends SlotSpec {
  title: string;
}

export interface ContextSectionSpec {
  id: string;
  order: number;
  appliesTo: SelectionKind[];
  render(props: { selection: Selection }): ReactNode;
}

export interface UiModule {
  id: string;
  title: string;
  navigatorTabs?: PanelSpec[];
  contextSections?: ContextSectionSpec[];
  topBar?: SlotSpec[];
  bottomBar?: SlotSpec[];
}

function copyModule(module: UiModule): UiModule {
  return {
    ...module,
    navigatorTabs: module.navigatorTabs?.map((item) => ({ ...item })),
    contextSections: module.contextSections?.map((item) => ({
      ...item,
      appliesTo: [...item.appliesTo],
    })),
    topBar: module.topBar?.map((item) => ({ ...item })),
    bottomBar: module.bottomBar?.map((item) => ({ ...item })),
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
    for (const slot of ['navigatorTabs', 'contextSections', 'topBar', 'bottomBar'] as const) {
      uniqueIds(
        candidate.flatMap<{ id: string }>((item) => item[slot] ?? []),
        slot,
      );
    }
    this.registered.push(candidate[candidate.length - 1]!);
  }

  modules(): UiModule[] {
    return this.registered.map(copyModule);
  }
  navigatorTabs(): PanelSpec[] {
    return ordered(this.modules().flatMap((module) => module.navigatorTabs ?? []));
  }
  contextSections(selection: Selection): ContextSectionSpec[] {
    return ordered(
      this.modules()
        .flatMap((module) => module.contextSections ?? [])
        .filter((section) => section.appliesTo.includes(selection.kind)),
    );
  }
  topBar(): SlotSpec[] {
    return ordered(this.modules().flatMap((module) => module.topBar ?? []));
  }
  bottomBar(): SlotSpec[] {
    return ordered(this.modules().flatMap((module) => module.bottomBar ?? []));
  }
}
