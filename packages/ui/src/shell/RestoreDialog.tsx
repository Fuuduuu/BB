import type { BackupInfo, BackupsReq, ProjectService } from '@pcbk/contracts';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import type { RecentProjectCard } from './StartScreen';
import { et } from './i18n/et';
import './project-screens.css';

export interface RestoreDialogProps {
  project: RecentProjectCard;
  loadBackups(req: BackupsReq): ReturnType<ProjectService['backups']>;
  onRestore(backup: string): Promise<boolean | 'exists'>;
  onClose(): void;
}

export function RestoreDialog({ project, loadBackups, onRestore, onClose }: RestoreDialogProps) {
  const [list, setList] = useState<BackupInfo[] | 'loading' | 'failed'>('loading');
  const [reload, setReload] = useState(0);
  const [selection, setSelection] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const submitting = useRef(false);
  const radioGroup = useId();

  useEffect(() => {
    let current = true;
    setList('loading');
    setSelection(null);
    async function load() {
      try {
        const result = await loadBackups({ projectId: project.projectId });
        if (!current) return;
        setList(
          result.ok
            ? [...result.value].sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
            : 'failed',
        );
      } catch {
        if (current) setList('failed');
      }
    }
    void load();
    return () => {
      current = false;
    };
  }, [loadBackups, project.projectId, reload]);

  const backups = Array.isArray(list) ? list : [];
  const selected = backups.find((backup) => backup.file === selection) ?? backups[0];
  const error = list === 'failed' ? et.project.restoreFailed : restoreError;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setRestoreError(null);
    try {
      const result = await onRestore(selected.file);
      if (result === 'exists') setRestoreError(et.reason.exists);
      else if (!result) setRestoreError(et.project.restoreFailed);
    } catch {
      setRestoreError(et.project.restoreFailed);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog open title={et.project.restoreTitle} onClose={onClose} closeDisabled={busy}>
      <form className="pcbk-restore" onSubmit={submit} aria-busy={busy}>
        {list === 'loading' && <p role="status">{et.project.restoreLoading}</p>}
        {Array.isArray(list) && !list.length && <p>{et.project.restoreNone}</p>}
        {backups.length > 0 && (
          <ul className="pcbk-restore__list">
            {backups.map((backup) => (
              <li key={backup.file}>
                <label className="pcbk-restore__choice">
                  <input
                    type="radio"
                    name={radioGroup}
                    checked={backup.file === selected?.file}
                    disabled={busy}
                    onChange={() => setSelection(backup.file)}
                  />
                  <time dateTime={backup.at}>
                    {new Date(backup.at).toLocaleString('et-EE', {
                      year: 'numeric',
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </time>
                  <span>
                    {backup.kind === 'full' ? et.project.restoreFull : et.project.restoreDoc}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p className="pcbk-restore__error" role="alert">
            {error}
          </p>
        )}
        <div className="pcbk-restore__actions">
          <Button onClick={onClose} disabled={busy}>
            {et.common.cancel}
          </Button>
          {list === 'failed' && (
            <Button onClick={() => setReload(reload + 1)}>{et.common.retry}</Button>
          )}
          <Button variant="primary" type="submit" busy={busy} disabled={!selected}>
            {et.project.restoreConfirm}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
