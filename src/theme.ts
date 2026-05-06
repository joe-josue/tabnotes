import type { ThemeMode } from './storage';

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode;
}
