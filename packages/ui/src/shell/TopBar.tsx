import type { SaveStatus as Status } from '@pcbk/contracts';
import type { ReactNode } from 'react';
import { Button } from '../kit/Button';
import { SaveStatus } from './SaveStatus';
import { et } from './i18n/et';
import { useViewStore } from './view-store';

export interface HistoryActions {
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
}
export function TopBar({
  name,
  status,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  children,
}: HistoryActions & { name: string; status: Status; children?: ReactNode }) {
  const contextOpen = useViewStore((s) => s.contextOpen);
  const setContextOpen = useViewStore((s) => s.setContextOpen);
  return (
    <header className="pcbk-topbar">
      <a className="pcbk-brand" href="#workspace" aria-label={et.appName}>
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
          <path d="M5 4v12h16M5 10h9v12" fill="none" stroke="currentColor" strokeWidth="2" />
          <rect x="1" y="1" width="8" height="6" rx="1" fill="currentColor" />
          <circle cx="21" cy="16" r="4" fill="currentColor" />
          <circle cx="14" cy="22" r="3" fill="currentColor" />
        </svg>
        <span>
          {et.brand.pcb}
          <span className="pcbk-brand-accent"> {et.brand.name}</span>
        </span>
      </a>
      <div className="pcbk-project-heading">
        <h1 title={name}>{name || et.shell.untitled}</h1>
        <SaveStatus status={status} />
      </div>
      <div className="pcbk-topbar-actions">
        {children}
        <Button
          variant="ghost"
          onClick={onUndo}
          disabled={!canUndo}
          title={`${et.shell.undo} · Ctrl+Z`}
          aria-label={et.shell.undo}
        >
          <span aria-hidden="true">↶</span>
        </Button>
        <Button
          variant="ghost"
          onClick={onRedo}
          disabled={!canRedo}
          title={`${et.shell.redo} · Ctrl+Y`}
          aria-label={et.shell.redo}
        >
          <span aria-hidden="true">↷</span>
        </Button>
        <span className="pcbk-toolbar-divider" />
        <Button
          variant="ghost"
          onClick={() => setContextOpen(!contextOpen)}
          aria-expanded={contextOpen}
          aria-controls="pcbk-context"
        >
          {contextOpen ? et.shell.hideContext : et.shell.showContext}
        </Button>
      </div>
    </header>
  );
}
