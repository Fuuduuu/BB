import { et } from './i18n/et';

export function defaultBoardName() {
  const today = new Date();
  const date = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return et.project.defaultName(date);
}

export function photoBoardName(file: File) {
  const stem = file.name
    .replace(/\.[^.]*$/, '')
    .trim()
    .slice(0, 80);
  return !stem || stem.toLowerCase() === 'foto' ? defaultBoardName() : stem;
}
