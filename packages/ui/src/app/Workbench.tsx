import { useMemo } from 'react';
import { useEngine, useSnapshot } from '@pcbk/client';
import type { AppHost, EngineError, Result } from '@pcbk/contracts';
import { boardSurface, sceneTransformOf } from '@pcbk/domain/geometry';
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
import { HomeFeedback, HomeFeedbackContext } from './HomeFeedback';
import './workbench.css';

function BoardCanvas({ registry }: { registry: UiRegistry }) {
  const engine = useEngine();
  const snapshot = useSnapshot((current) => current);
  const execute = useMemo(() => engine.execute.bind(engine), [engine]);
  const layers = useMemo(() => registry.canvasLayers(), [registry]);
  const tools = useMemo(() => registry.tools(), [registry]);
  const keys = useMemo(() => registry.keys(), [registry]);
  const view = useViewStore((state) => state.boardView);
  const contextShown = useViewStore((state) => state.contextShown);
  const contextWidth = useViewStore((state) => state.contextWidth);
  const setBoardView = useViewStore((state) => state.setBoardView);
  return (
    <Canvas
      layers={layers}
      tools={tools}
      keys={keys}
      snapshot={snapshot}
      execute={execute}
      sceneTransform={sceneTransformOf(snapshot.doc)}
      surface={boardSurface(snapshot.doc)}
      fitInsets={{ right: contextShown ? contextWidth : 0 }}
      view={view}
      onViewChange={setBoardView}
    />
  );
}

export function Workbench({
  host,
  uiModules,
  addPhoto,
}: {
  host: AppHost;
  addPhoto?: (file: File) => Promise<Result<void, EngineError>>;
  uiModules: (onHome: () => void) => UiModule[];
}) {
  useTheme();
  const workbench = useWorkbench(host, addPhoto);
  const { goHome } = workbench;
  const registry = useMemo(
    () =>
      new UiRegistry([
        ...uiModules(goHome),
        {
          id: 'home-feedback',
          title: '',
          bottomBar: [{ id: 'home-feedback', order: -100, render: () => <HomeFeedback /> }],
        },
      ]),
    [uiModules, goHome],
  );
  const copyAvailable = Boolean(workbench.info && host.pickSavePath);
  const restoreAvailable = host.kind === 'desktop' && Boolean(host.pickSavePath);

  return (
    <>
      <RootErrorBoundary
        onCopyAndReload={() => workbench.copy('reload')}
        onExportDiagnostics={workbench.diagnose}
        copyAvailable={Boolean(workbench.info && (host.recoveryCopyPath || host.pickSavePath))}
      >
        <HomeFeedbackContext.Provider value={workbench.photoError}>
          <fieldset
            className="pcbk-workbench-controls"
            disabled={workbench.busy}
            aria-busy={workbench.busy}
            onClickCapture={(event) => {
              if (workbench.busy) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            onPointerDownCapture={(event) => {
              if (workbench.busy) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            onKeyDownCapture={(event) => {
              if (workbench.busy) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
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
                busy={workbench.busy}
                {...(addPhoto && { onPhotoFiles: workbench.createFromPhoto })}
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
          </fieldset>
        </HomeFeedbackContext.Provider>
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
      </RootErrorBoundary>
      <CloseDialog
        open={workbench.closeError !== null}
        reason={workbench.closeError?.reason ?? 'unknown'}
        opening={typeof workbench.closeError?.intent === 'object'}
        busy={workbench.busy}
        copyAvailable={copyAvailable}
        onCancel={workbench.cancelClose}
        onRetrySave={workbench.retryClose}
        onSaveElsewhere={() => workbench.copy('close')}
        onDiscard={workbench.discard}
      />
      {(workbench.launchError || workbench.rescueNotice) && (
        <div className="pcbk-web-alert" role="alert">
          <span>{workbench.launchError ?? workbench.rescueNotice}</span>
          <Button
            onClick={workbench.dismissError}
            aria-label={et.common.close}
            disabled={workbench.busy}
          >
            {et.common.close}
          </Button>
        </div>
      )}
    </>
  );
}
