import { useSessionStore } from '@pcbk/ui';
import { connectionsEt } from './i18n/et';
import { TRACE_TOOL_ID, useTraceStore } from './trace-store';

function ActiveTraceHint() {
  const mode = useTraceStore((state) => state.mode);
  const error = useTraceStore((state) => state.error);
  const hint =
    mode.kind === 'wire'
      ? connectionsEt.traceWire
      : mode.layer === 'top'
        ? connectionsEt.traceTop
        : connectionsEt.traceBottom;
  return (
    <span role="status">
      {hint}
      {error && ` · ${error}`}
    </span>
  );
}

export function TraceHint() {
  return useSessionStore((state) => state.toolId) === TRACE_TOOL_ID ? <ActiveTraceHint /> : null;
}
