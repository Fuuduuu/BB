#[cfg(any(feature = "tauri-ipc", test))]
mod desktop_paths;
#[cfg(feature = "tauri-ipc")]
pub mod ipc;
#[cfg(any(feature = "tauri-ipc", test))]
mod logging;
pub mod storage;
