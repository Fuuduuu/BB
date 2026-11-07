// The host provides timers. Backend code may only retain or cancel the opaque handle.
interface BackendTimeoutHandle {
  readonly __backendTimeoutHandle: unique symbol;
}

declare function setTimeout(callback: () => void, delay?: number): BackendTimeoutHandle;
declare function clearTimeout(handle?: BackendTimeoutHandle): void;
