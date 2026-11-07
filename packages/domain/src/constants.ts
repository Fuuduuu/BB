import type { NetRole } from './model/net';

export const HISTORY_LIMIT = 200;
export const SAVE_DEBOUNCE_MS = 1500;
export const SAVE_MAX_WAIT_MS = 10000;
export const DOC_BACKUP_INTERVAL_MS = 1_800_000;
export const BACKUP_KEEP = 5;
export const CURRENT_FORMAT_VERSION = 1;

export const DEFAULT_ROLES = [
  { id: 'rol_gnd', label: 'GND', kind: 'ground', nominalV: 0, color: '#1f2523' },
  { id: 'rol_3v3', label: '3V3', kind: 'power', nominalV: 3.3, color: '#e8891c' },
  { id: 'rol_5v', label: '5V', kind: 'power', nominalV: 5, color: '#d9342b' },
  { id: 'rol_12v', label: '12V', kind: 'power', nominalV: 12, color: '#2a64d6' },
  { id: 'rol_sig', label: 'Signaal', kind: 'signal', color: '#8a4fd3' },
  { id: 'rol_unk', label: 'Teadmata', kind: 'unknown', color: '#8c9692' },
] as const satisfies readonly NetRole[];
