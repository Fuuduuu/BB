import { nanoid } from 'nanoid';

export type IdPrefix =
  | 'cmp'
  | 'jun'
  | 'con'
  | 'lbl'
  | 'rol'
  | 'msr'
  | 'rep'
  | 'pho'
  | 'dim'
  | 'are'
  | 'att'
  | 'txt'
  | 'pin';

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${nanoid(10)}`;
}
