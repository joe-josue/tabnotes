export function initTheme(): void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    document.documentElement.dataset.theme = mq.matches ? 'dark' : 'light';
  };
  apply();
  mq.addEventListener('change', apply);
}
