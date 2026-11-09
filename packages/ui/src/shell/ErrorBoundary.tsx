import { Component } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import { Button } from '../kit/Button';
import { et } from './i18n/et';

class Boundary extends Component<
  PropsWithChildren<{ fallback: (retry: () => void) => ReactNode }>,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed
      ? this.props.fallback(() => this.setState({ failed: false }))
      : this.props.children;
  }
}
export interface RootRecoveryActions {
  copyAvailable?: boolean;
  onCopyAndReload(): void;
  onExportDiagnostics(): void;
}
export function RootErrorBoundary({
  children,
  onCopyAndReload,
  onExportDiagnostics,
  copyAvailable = true,
}: PropsWithChildren<RootRecoveryActions>) {
  return (
    <Boundary
      fallback={() => (
        <main className="pcbk-root-error" role="alert">
          <div className="pcbk-root-error-content">
            <h1>{et.error.root}</h1>
            <div className="pcbk-inline-actions">
              <Button
                variant="primary"
                onClick={onCopyAndReload}
                disabled={!copyAvailable}
                title={copyAvailable ? undefined : et.project.copyUnavailable}
              >
                {et.error.copyReload}
              </Button>
              <Button onClick={onExportDiagnostics}>{et.error.diagnostics}</Button>
            </div>
          </div>
        </main>
      )}
    >
      {children}
    </Boundary>
  );
}
export function PanelErrorBoundary({ children }: PropsWithChildren) {
  return (
    <Boundary
      fallback={(retry) => (
        <div className="pcbk-panel-error" role="alert">
          <p>{et.error.panel}</p>
          <Button onClick={retry}>{et.common.retry}</Button>
        </div>
      )}
    >
      {children}
    </Boundary>
  );
}
