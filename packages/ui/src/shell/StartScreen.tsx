import { useState } from 'react';
import type { RecentProject } from '@pcbk/contracts';
import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { et } from './i18n/et';
import './project-screens.css';

export type RecentProjectCard = RecentProject;

export interface StartScreenProps {
  recent: readonly RecentProjectCard[];
  availableProjects?: readonly RecentProjectCard[];
  openAvailable?: boolean;
  onPickProjectFile?(): void;
  showBrowserStorage?: boolean;
  onNew(): void;
  onOpen(path: string): void;
  onRestore?(project: RecentProjectCard): void;
  onRemoveRecent(path: string): void;
}

function ProjectButton({
  project,
  onOpen,
}: {
  project: RecentProjectCard;
  onOpen(path: string): void;
}) {
  return (
    <button
      type="button"
      className="pcbk-project-card__open"
      aria-label={et.project.openNamed(project.name)}
      disabled={project.missing}
      onClick={() => onOpen(project.path)}
    >
      <strong>{project.name}</strong>
      {project.device && <span>{project.device}</span>}
      <time dateTime={project.updatedAt}>
        {new Date(project.updatedAt).toLocaleString('et-EE', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })}
      </time>
      {project.missing && <span className="pcbk-project-card__missing">{et.project.missing}</span>}
    </button>
  );
}

export function StartScreen({
  recent,
  availableProjects = recent,
  openAvailable = true,
  onPickProjectFile,
  showBrowserStorage = true,
  onNew,
  onOpen,
  onRestore,
  onRemoveRecent,
}: StartScreenProps) {
  const [openList, setOpenList] = useState(false);
  return (
    <main className="pcbk-start">
      <div className="pcbk-start__content">
        <header className="pcbk-start__intro">
          <div className="pcbk-start__brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h1>
            <span>{et.brand.pcb}</span> {et.brand.name}
          </h1>
          <p>{et.project.intro}</p>
          <div className="pcbk-start__actions">
            <Button variant="primary" onClick={onNew}>
              {et.project.newBoard}
            </Button>
            <Button
              disabled={!openAvailable}
              title={openAvailable ? undefined : et.project.openFailed}
              onClick={onPickProjectFile ?? (() => setOpenList(true))}
            >
              {et.project.open}
            </Button>
          </div>
          {showBrowserStorage && <p className="pcbk-start__storage">{et.project.browserStorage}</p>}
        </header>
        <section className="pcbk-start__recent" aria-labelledby="pcbk-recent-heading">
          <h2 id="pcbk-recent-heading">{et.project.recent}</h2>
          {recent.length === 0 ? (
            <p className="pcbk-start__empty">{et.project.noRecent}</p>
          ) : (
            <div className="pcbk-project-grid">
              {recent.map((project) => (
                <article className="pcbk-project-card" key={project.path}>
                  <ProjectButton project={project} onOpen={onOpen} />
                  <div className="pcbk-project-card__actions">
                    <span title={onRestore ? undefined : et.project.restoreUnavailable}>
                      <Button
                        variant="ghost"
                        disabled={!onRestore}
                        title={onRestore ? undefined : et.project.restoreUnavailable}
                        onClick={() => onRestore?.(project)}
                      >
                        {et.project.restore}
                      </Button>
                    </span>
                    {project.missing && (
                      <Button variant="ghost" onClick={() => onRemoveRecent(project.path)}>
                        {et.project.removeRecent}
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      {openList && (
        <Dialog open title={et.project.openTitle} onClose={() => setOpenList(false)}>
          <p className="pcbk-open-list__hint">{et.project.browserStorage}</p>
          {availableProjects.length === 0 ? (
            <p>{et.project.emptyOpen}</p>
          ) : (
            <div className="pcbk-open-list">
              {availableProjects.map((project) => (
                <ProjectButton
                  key={project.path}
                  project={project}
                  onOpen={(path) => {
                    setOpenList(false);
                    onOpen(path);
                  }}
                />
              ))}
            </div>
          )}
        </Dialog>
      )}
    </main>
  );
}
