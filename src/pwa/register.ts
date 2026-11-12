import { registerSW } from 'virtual:pwa-register';
import { element } from '../app/AppController';
export function setupPWA(notice: (message: string) => void) {
  let activationRequested = false;
  let reloadReady = false;
  // Workbox may classify a worker discovered in another tab as external.
  // Handle native controller changes after this tab's explicit update action.
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (activationRequested) window.location.reload();
  });
  let update: (reloadPage?: boolean) => Promise<void>;
  update = registerSW({
    onNeedReload() {
      if (activationRequested) window.location.reload();
      else {
        reloadReady = true;
        element('update-prompt').hidden = false;
      }
    },
    onNeedRefresh() {
      element('update-prompt').hidden = false;
    },
    onOfflineReady() {
      notice(
        'Ready for offline use. Your saved models are stored separately on this device.',
      );
    },
    onRegisterError() {
      notice(
        'Offline setup failed. You can continue online and retry by reloading.',
      );
    },
    onRegisteredSW(_url, registration) {
      if (registration)
        window.setInterval(
          () => {
            if (navigator.onLine) void registration.update().catch(() => {});
          },
          60 * 60 * 1000,
        );
    },
  });
  element('update-now').addEventListener('click', async () => {
    const button = element<HTMLButtonElement>('update-now');
    button.disabled = true;
    button.textContent = 'Updating…';
    activationRequested = true;
    if (reloadReady) {
      window.location.reload();
      return;
    }
    const timeout = setTimeout(() => {
      activationRequested = false;
      button.disabled = false;
      button.textContent = 'Retry update';
      notice('Update has not completed. Please retry when online.');
    }, 15000);
    try {
      await update(true);
    } catch {
      clearTimeout(timeout);
      button.disabled = false;
      button.textContent = 'Retry update';
      notice('Update failed. Your current app is still available.');
    }
  });
  element('update-later').addEventListener('click', () => {
    element('update-prompt').hidden = true;
  });
  let prompt: any;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    prompt = event;
    element('install').hidden = false;
  });
  element('install').addEventListener('click', async () => {
    if (prompt) {
      await prompt.prompt();
      prompt = undefined;
      element('install').hidden = true;
    }
  });
  window.addEventListener('appinstalled', () => {
    element('install').hidden = true;
  });
  const connection = () => {
    element('connection').textContent = navigator.onLine
      ? 'Local & private'
      : 'Offline · local files work';
  };
  window.addEventListener('online', connection);
  window.addEventListener('offline', connection);
  connection();
}
