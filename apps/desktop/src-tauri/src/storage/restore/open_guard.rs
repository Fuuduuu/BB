use super::{Reason, StorageErrorDto, StorageResult, SIDECARS};
use rusqlite::ffi;
use std::{
    cell::Cell,
    ffi::{c_char, c_int, CStr},
    ptr,
    sync::OnceLock,
};

const NAME: &CStr = c"pcbk-restore-open";
static REGISTERED: OnceLock<bool> = OnceLock::new();

#[derive(Clone, Copy, PartialEq, Eq)]
enum State {
    Idle,
    Opening,
    Conflict,
}

thread_local! {
    // Opening and describing the restored project are synchronous SQLite calls.
    static STATE: Cell<State> = const { Cell::new(State::Idle) };
}

struct Guard;

impl Drop for Guard {
    fn drop(&mut self) {
        STATE.set(State::Idle);
    }
}

pub(super) fn protect<T>(open: impl FnOnce(&CStr) -> StorageResult<T>) -> StorageResult<T> {
    if !REGISTERED.get_or_init(register) || STATE.get() != State::Idle {
        return Err(StorageErrorDto::new(Reason::Unknown));
    }
    STATE.set(State::Opening);
    let _guard = Guard;
    let result = open(NAME);
    if STATE.get() == State::Conflict {
        return Err(StorageErrorDto::new(Reason::Exists));
    }
    result
}

#[repr(C)]
struct RestoreVfs {
    vfs: ffi::sqlite3_vfs,
    native: *mut ffi::sqlite3_vfs,
}

fn register() -> bool {
    // SQLite owns the native VFS for the lifetime of the process. Retain its
    // file layout, platform callbacks and private data. Do not make this VFS
    // the default for normal project opens.
    unsafe {
        let native = ffi::sqlite3_vfs_find(ptr::null());
        if native.is_null() {
            return false;
        }
        let mut vfs = *native;
        vfs.pNext = ptr::null_mut();
        vfs.zName = NAME.as_ptr();
        vfs.xOpen = Some(open_file);
        vfs.xAccess = Some(access);
        vfs.xDelete = Some(delete);
        let registered = Box::into_raw(Box::new(RestoreVfs { vfs, native }));
        if ffi::sqlite3_vfs_register(registered.cast(), 0) == ffi::SQLITE_OK {
            // SQLite keeps this pointer, including for later session writes.
            true
        } else {
            drop(Box::from_raw(registered));
            false
        }
    }
}

fn deny_during_open() -> bool {
    if STATE.get() == State::Idle {
        return false;
    }
    STATE.set(State::Conflict);
    true
}

fn is_sidecar(name: &CStr) -> bool {
    SIDECARS
        .iter()
        .any(|suffix| name.to_bytes().ends_with(suffix.as_bytes()))
}

unsafe extern "C" fn open_file(
    vfs: *mut ffi::sqlite3_vfs,
    name: ffi::sqlite3_filename,
    file: *mut ffi::sqlite3_file,
    flags: c_int,
    out_flags: *mut c_int,
) -> c_int {
    let journal_flags =
        ffi::SQLITE_OPEN_MAIN_JOURNAL | ffi::SQLITE_OPEN_SUPER_JOURNAL | ffi::SQLITE_OPEN_WAL;
    // SQLite requires pMethods to be null when xOpen fails.
    unsafe {
        let native = (*vfs.cast::<RestoreVfs>()).native;
        if flags & journal_flags == 0 || !deny_during_open() {
            if let Some(open) = (*native).xOpen {
                return open(native, name, file, flags, out_flags);
            }
        }
        (*file).pMethods = ptr::null();
    }
    ffi::SQLITE_IOERR
}

unsafe extern "C" fn access(
    vfs: *mut ffi::sqlite3_vfs,
    name: *const c_char,
    flags: c_int,
    found: *mut c_int,
) -> c_int {
    // SQLite supplies a terminated filename and a writable result. The
    // native access callback only checks the directory entry.
    unsafe {
        let native = (*vfs.cast::<RestoreVfs>()).native;
        let Some(access) = (*native).xAccess else {
            return ffi::SQLITE_IOERR_ACCESS;
        };
        let result = access(native, name, flags, found);
        if result == ffi::SQLITE_OK
            && *found != 0
            && STATE.get() != State::Idle
            && is_sidecar(CStr::from_ptr(name))
        {
            STATE.set(State::Conflict);
            return ffi::SQLITE_IOERR_ACCESS;
        }
        result
    }
}

unsafe extern "C" fn delete(
    vfs: *mut ffi::sqlite3_vfs,
    name: *const c_char,
    sync_dir: c_int,
) -> c_int {
    // SQLite supplies a terminated filename. Guard even a deletion reached
    // without first opening the journal.
    unsafe {
        if STATE.get() != State::Idle && is_sidecar(CStr::from_ptr(name)) && deny_during_open() {
            return ffi::SQLITE_IOERR_DELETE;
        }
        let native = (*vfs.cast::<RestoreVfs>()).native;
        (*native)
            .xDelete
            .map_or(ffi::SQLITE_IOERR_DELETE, |delete| {
                delete(native, name, sync_dir)
            })
    }
}
