import { useMemo } from 'react';
import type { AppHost } from '@pcbk/contracts';
import { Button } from '../kit/Button';
import { AppShell } from '../shell/AppShell';
import { CloseDialog } from '../shell/CloseDialog';
import { RootErrorBoundary } from '../shell/ErrorBoundary';
import { NewBoardDialog } from '../shell/NewBoardDialog';
import { StartScreen } from '../shell/StartScreen';
import { UiRegistry, type UiModule } from '../shell/UiRegistry';
import { et } from '../shell/i18n/et';
import { useTheme } from '../shell/use-theme';
import { useWorkbench } from './use-workbench';
import './workbench.css';

export function Workbench({
  host,
  uiModules,
}: {
  host: AppHost;
  uiModules: (onHome: () => void) => UiModule[];
}) {
  useTheme();
  const workbench = useWorkbench(host);
  const { goHome } = workbench;
  const registry = useMemo(() => new UiRegistry(uiModules(goHome)), [uiModules, goHome]);
  const copyAvailable = Boolean(workbench.info && host.pickSavePath);

  return (
    <RootErrorBoundary
      onCopyAndReload={() => workbench.copy('reload')}
      onExportDiagnostics={workbench.diagnose}
      copyAvailable={copyAvailable}
    >
      {workbench.info ? (
        <AppShell
          manageTheme={false}
          registry={registry}
          copyAvailable={copyAvailable}
          onRetrySave={workbench.retrySave}
          onSaveElsewhere={() => workbench.copy('stay')}
          onCopyAndReload={() => workbench.copy('reload')}
          onExportDiagnostics={workbench.diagnose}
        />
      ) : (
        <StartScreen
          recent={workbench.recent}
          availableProjects={workbench.available}
          openAvailable={Boolean(host.listOpenable || host.pickProjectFile)}
          {...(host.pickProjectFile && { onPickProjectFile: workbench.pickProjectFile })}
          showBrowserStorage={host.kind === 'web'}
          onNew={workbench.openCreate}
          onOpen={workbench.open}
          onRemoveRecent={workbench.removeRecent}
        />
      )}
      <NewBoardDialog
        open={workbench.createOpen}
        busy={workbench.busy}
        error={workbench.createError}
        onClose={workbench.closeCreate}
        onCreate={workbench.create}
      />
      <CloseDialog
        open={workbench.closeError !== null}
        reason={workbench.closeError?.reason ?? 'unknown'}
        busy={workbench.busy}
        copyAvailable={copyAvailable}
        onCancel={workbench.cancelClose}
        onRetrySave={workbench.retryClose}
        onSaveElsewhere={() => workbench.copy('close')}
        onDiscard={workbench.discard}
      />
      {workbench.launchError && (
        <div className="pcbk-web-alert" role="alert">
          <span>{workbench.launchError}</span>
          <Button onClick={workbench.dismissError} aria-label={et.common.close}>
            {et.common.close}
          </Button>
        </div>
      )}
    </RootErrorBoundary>
  );
}
