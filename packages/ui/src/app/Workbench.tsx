import { useMemo } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import type { AppHost } from '@pcbk/contracts';
import { Canvas } from '../canvas/Canvas';
import { Button } from '../kit/Button';
import { AppShell } from '../shell/AppShell';
import { CloseDialog } from '../shell/CloseDialog';
import { RootErrorBoundary } from '../shell/ErrorBoundary';
import { NewBoardDialog } from '../shell/NewBoardDialog';
import { RestoreDialog } from '../shell/RestoreDialog';
import { StartScreen } from '../shell/StartScreen';
import { UiRegistry, type UiModule } from '../shell/UiRegistry';
import { et } from '../shell/i18n/et';
import { useTheme } from '../shell/use-theme';
import { useViewStore } from '../shell/view-store';
import { useWorkbench } from './use-workbench';
import './workbench.css';

const boardSurface = { width: 2000, height: 1400 };

function BoardCanvas({ registry }: { registry: UiRegistry }) {
  const engine = useEngine();
  const snapshot = useSnapshot((current) => current);
  const execute = useMemo(() => engine.execute.bind(engine), [engine]);
  const layers = useMemo(() => registry.canvasLayers(), [registry]);
  const tools = useMemo(() => registry.tools(), [registry]);
  const keys = useMemo(() => registry.keys(), [registry]);
  const view = useViewStore((state) => state.boardView);
  const setBoardView = useViewStore((state) => state.setBoardView);
  return (
    <Canvas
      layers={layers}
      tools={tools}
      keys={keys}
      snapshot={snapshot}
      execute={execute}
      sceneTransform="none"
      surface={boardSurface}
      view={view}
      onViewChange={setBoardView}
    />
  );
}

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
  const restoreAvailable = host.kind === 'desktop' && Boolean(host.pickSavePath);

  return (
    <RootErrorBoundary
      onCopyAndReload={() => workbench.copy('reload')}
      onExportDiagnostics={workbench.diagnose}
      copyAvailable={Boolean(workbench.info && (host.recoveryCopyPath || host.pickSavePath))}
    >
      {workbench.info ? (
        <AppShell
          manageTheme={false}
          registry={registry}
          canvas={<BoardCanvas registry={registry} />}
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
          {...(restoreAvailable && { onRestore: workbench.openRestore })}
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
      {workbench.restoreSource && (
        <RestoreDialog
          project={workbench.restoreSource}
          loadBackups={workbench.loadBackups}
          onRestore={workbench.restore}
          onClose={workbench.closeRestore}
        />
      )}
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
