import './styles/app.css';
import { shell } from './ui/shell';
import { AppController, element } from './app/AppController';
import { setupPWA } from './pwa/register';

element('app').innerHTML = shell;
const app = new AppController();
const system = matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => {
  const value = element<HTMLSelectElement>('theme').value;
  const dark = value === 'dark' || (value === 'system' && system.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#1b222d' : '#ffffff');
};
try {
  element<HTMLSelectElement>('theme').value =
    localStorage.getItem('glb-studio-theme') || 'system';
} catch {
  /* Theme remains usable when browser storage is disabled. */
}
element('theme').addEventListener('change', () => {
  applyTheme();
  try {
    localStorage.setItem(
      'glb-studio-theme',
      element<HTMLSelectElement>('theme').value,
    );
  } catch {
    /* Storage is optional. */
  }
});
system.addEventListener('change', applyTheme);
applyTheme();
if (import.meta.env.PROD) setupPWA((message) => app.notice(message));
